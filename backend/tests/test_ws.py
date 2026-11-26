"""WebSocket /ws/metricas (contrato v0.11). Sin red: reutiliza las bases falsas de las métricas."""
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import create_app
from tests.test_metricas import CAPELLA, TIDB, Guion

RUTA = "/ws/metricas"


@pytest.fixture
def app(settings_prueba):
    return create_app(settings_prueba, Guion(TIDB), Guion(CAPELLA))


@pytest.fixture
def cliente(app):
    return TestClient(app)


def sesion(app, rol="analista"):
    return {"Authorization": f"Bearer {app.state.tokens.crear(1, rol)}"}


def test_manda_el_resumen_al_conectarse(app, cliente):
    with cliente.websocket_connect(RUTA, headers=sesion(app)) as ws:
        mensaje = ws.receive_json()
    assert mensaje["evento"] == "metricas.actualizadas"
    assert mensaje["datos"]["usuarios"] == 10 and mensaje["datos"]["interacciones"] == 3


def test_funciona_con_la_cookie_del_dashboard(app, cliente):
    cliente.cookies.set("c360_token", app.state.tokens.crear(1, "analista"))
    with cliente.websocket_connect(RUTA, headers={"Origin": "http://localhost:5173"}) as ws:
        assert ws.receive_json()["evento"] == "metricas.actualizadas"


def test_reenvia_el_resumen_cuando_el_crud_avisa(app, cliente):
    with cliente.websocket_connect(RUTA, headers=sesion(app)) as ws:
        ws.receive_json()
        app.state.avisar_cambio()  # lo mismo que hace el CRUD después de escribir
        assert ws.receive_json()["evento"] == "metricas.actualizadas"
        ws.send_json({"tipo": "ping"})
        assert ws.receive_json() == {"evento": "pong"}
    assert app.state.difusor.calculos == 2


def test_sin_clientes_no_consulta_las_bases(app):
    app.state.avisar_cambio()
    time.sleep(0.05)
    assert app.state.difusor.calculos == 0


@pytest.mark.parametrize("encabezados, codigo", [
    ({}, 4401),                                                  # sin sesión
    ({"Authorization": "Bearer no-es-un-token"}, 4401),
    ({"Origin": "https://otro-sitio.example"}, 4403),            # otra página no usa la cookie
])
def test_rechaza(app, cliente, encabezados, codigo):
    if codigo == 4403:
        encabezados = {**encabezados, **sesion(app)}
    with pytest.raises(WebSocketDisconnect) as e, cliente.websocket_connect(RUTA, headers=encabezados) as ws:
        ws.receive_json()
    assert e.value.code == codigo
    assert app.state.difusor.calculos == 0


def test_sesion_revocada_se_cierra_en_el_siguiente_envio(app, cliente):
    token = app.state.tokens.crear(1, "analista")
    with cliente.websocket_connect(RUTA, headers={"Authorization": f"Bearer {token}"}) as ws:
        ws.receive_json()
        app.state.tokens.revocar(app.state.tokens.validar(token))  # logout en otra pestaña
        app.state.avisar_cambio()
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
    assert e.value.code == 4401


@pytest.mark.nube
def test_ws_con_bases_reales_reenvia_tras_crear_y_borrar():
    """Crea y borra su propia interacción en Capella real; recibe el resumen después de cada una."""
    from tests.test_interacciones import valida

    app = create_app()
    admin = sesion(app, "admin")
    with TestClient(app) as cliente, cliente.websocket_connect(RUTA, headers=admin) as ws:
        inicial = ws.receive_json()
        assert inicial["evento"] == "metricas.actualizadas", inicial
        usuario = cliente.get("/api/usuarios", headers=admin, params={"limite": 1}).json()["datos"][0]
        cuerpo = valida(id_usuario=usuario["id_usuario"], etiquetas=["musica"], texto="Prueba WebSocket")
        creada = cliente.post("/api/interacciones", headers=admin, json=cuerpo)
        assert creada.status_code == 201, creada.text
        try:
            tras_crear = ws.receive_json()
        finally:
            assert cliente.delete(f"/api/interacciones/{creada.json()['id_interaccion']}",
                                  headers=admin).status_code == 204
        tras_borrar = ws.receive_json()
    assert tras_crear["datos"]["interacciones"] == inicial["datos"]["interacciones"] + 1
    assert tras_borrar["datos"]["interacciones"] == inicial["datos"]["interacciones"]
