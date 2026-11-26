"""Clientes conectados a /ws/metricas y envío del resumen cuando el CRUD cambia algo.

Sin sondeo: las bases solo se consultan al conectarse un cliente y después de cada cambio,
y solo si hay alguien conectado.
"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket
from fastapi.concurrency import run_in_threadpool

from app.routers.metricas import calcular_resumen
from app.tokens import TokenInvalido

logger = logging.getLogger("community360.ws")

SESION_VENCIDA = 4401


def ahora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Difusor:
    def __init__(self, app: FastAPI):
        self._app = app
        self._clientes: dict[WebSocket, str] = {}  # conexión -> token con el que entró
        self._loop: asyncio.AbstractEventLoop | None = None
        self.calculos = 0  # cuántas veces se consultaron las bases (lo revisan las pruebas)
        self._en_fila = asyncio.Lock()

    @property
    def conectados(self) -> int:
        return len(self._clientes)

    def registrar(self, websocket: WebSocket, token: str) -> None:
        self._loop = asyncio.get_running_loop()
        self._clientes[websocket] = token

    def quitar(self, websocket: WebSocket) -> None:
        self._clientes.pop(websocket, None)

    def avisar(self, tipo: str, id_interaccion: str) -> None:
        """Lo llama el CRUD después de escribir, desde cualquier hilo. No espera el envío.

        `tipo` es "creada", "editada" o "borrada".
        """
        if not self._clientes or self._loop is None or self._loop.is_closed():
            return
        cambio = {"tipo": tipo, "id_interaccion": id_interaccion}
        asyncio.run_coroutine_threadsafe(self.difundir(cambio), self._loop)

    async def mensaje_resumen(self, cambio: dict | None = None) -> dict:
        """`cambio` es None al conectarse o cuando el cliente pide actualizar."""
        self.calculos += 1
        state = self._app.state
        try:
            resumen = await run_in_threadpool(calcular_resumen, state.tidb, state.capella)
        except Exception as e:
            logger.warning("No se pudo calcular el resumen (%s)", type(e).__name__)
            return {"evento": "metricas.no_disponibles", "cambio": cambio,
                    "datos": {"detail": "Base de datos no disponible"}, "ts": ahora_utc()}
        return {"evento": "metricas.actualizadas", "cambio": cambio,
                "datos": resumen.model_dump(), "ts": ahora_utc()}

    async def enviar(self, websocket: WebSocket, mensaje: dict) -> bool:
        """Envía si la sesión sigue vigente; si venció o fue revocada, cierra con 4401."""
        token = self._clientes.get(websocket)
        if token is None:
            return False
        try:
            self._app.state.tokens.validar(token)
        except TokenInvalido:
            self.quitar(websocket)
            await self._cerrar(websocket, SESION_VENCIDA)
            return False
        try:
            await websocket.send_json(mensaje)
            return True
        except Exception:
            self.quitar(websocket)  # el cliente se fue sin avisar
            return False

    async def difundir(self, cambio: dict) -> None:
        # En fila: si llegan dos cambios seguidos, sus mensajes salen en el mismo orden
        async with self._en_fila:
            mensaje = await self.mensaje_resumen(cambio)
            for websocket in list(self._clientes):
                await self.enviar(websocket, mensaje)

    @staticmethod
    async def _cerrar(websocket: WebSocket, codigo: int) -> None:
        try:
            await websocket.close(code=codigo)
        except Exception:
            pass
