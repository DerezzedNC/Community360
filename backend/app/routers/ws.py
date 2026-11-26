"""WebSocket /ws/metricas (contrato v0.11): resumen al conectarse y después de cada cambio."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.dependencias import leer_token
from app.difusor import SESION_VENCIDA
from app.tokens import TokenInvalido

router = APIRouter()

ORIGEN_NO_PERMITIDO = 4403


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
                continue
            if isinstance(mensaje, dict) and mensaje.get("tipo") == "ping":
                await difusor.enviar(websocket, {"evento": "pong"})
    except (WebSocketDisconnect, RuntimeError):
        pass  # el cliente cerró, o el difusor cerró la conexión por sesión vencida
    finally:
        difusor.quitar(websocket)
