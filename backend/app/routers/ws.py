"""WebSocket /ws/metricas (contrato v0.13): resumen al conectarse, después de cada cambio y a pedido."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.dependencias import leer_token
from app.difusor import SESION_VENCIDA, ahora_utc
from app.tokens import TokenInvalido

router = APIRouter()

ORIGEN_NO_PERMITIDO = 4403


def mensaje_error(detalle: str) -> dict:
    return {"evento": "error", "datos": {"detail": detalle}, "ts": ahora_utc()}


@router.websocket("/ws/metricas")
async def ws_metricas(websocket: WebSocket) -> None:
    app = websocket.app
    difusor = app.state.difusor
    await websocket.accept()

    # Un navegador siempre manda Origin: una página de otro sitio no puede usar la cookie aquí.
    # Postman y otros clientes que no lo mandan pasan a la revisión de la sesión.
    origen = websocket.headers.get("origin")
    if origen and origen != app.state.settings.FRONTEND_ORIGEN:
        await websocket.close(code=ORIGEN_NO_PERMITIDO)
        return

    # La misma sesión que las rutas HTTP: Bearer o cookie c360_token
    token = leer_token(websocket)
    try:
        app.state.tokens.validar(token)
    except TokenInvalido:
        await websocket.close(code=SESION_VENCIDA)
        return

    difusor.registrar(websocket, token)
    try:
        if not await difusor.enviar(websocket, await difusor.mensaje_resumen()):
            return
        while True:
            texto = await websocket.receive_text()
            try:
                mensaje = json.loads(texto)
            except ValueError:
                mensaje = None
            if not isinstance(mensaje, dict):
                respuesta = mensaje_error("El mensaje debe ser un objeto JSON")
            elif mensaje == {"accion": "actualizar"}:
                respuesta = await difusor.mensaje_resumen()
            elif mensaje == {"tipo": "ping"}:
                respuesta = {"evento": "pong"}
            else:
                respuesta = mensaje_error("Mensaje no reconocido")  # la conexión sigue abierta
            # enviar() revisa la sesión: si venció, cierra con 4401 y el ciclo termina
            await difusor.enviar(websocket, respuesta)
    except (WebSocketDisconnect, RuntimeError):
        pass  # el cliente cerró, o el difusor cerró la conexión por sesión vencida
    finally:
        difusor.quitar(websocket)
