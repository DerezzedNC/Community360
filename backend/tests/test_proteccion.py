"""Sesión obligatoria en /api/* y permisos por rol (contrato v0.4)."""
import re

import pymysql
import pytest
from fastapi import APIRouter, WebSocket
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.dependencias import RUTAS_DE_AMBOS_ROLES, RUTAS_PUBLICAS
from app.main import create_app
from tests.conftest import BaseFalsa
from tests.falsos import PASSWORD, TiDBFalsa

SIN_SESION = {"detail": "Sesión no válida o vencida"}
SIN_PERMISO = {"detail": "Tu rol no permite esta operación"}
ESCRITURAS = ["POST", "PUT", "PATCH", "DELETE"]
BUENO = {"n": 1}
MALO = {"n": "texto"}


class Cuerpo(BaseModel):
    n: int


class TiDBContada(TiDBFalsa):
    """Cuenta las conexiones, para saber si una petición tocó TiDB."""

    conexiones = 0

    def conexion(self):
        self.conexiones += 1
        return super().conexion()


@pytest.fixture
def tidb():
    return TiDBContada()


@pytest.fixture
def app(settings_prueba, tidb):
    """La app real más rutas que solo existen aquí y que no piden sesión por su cuenta."""
    app = create_app(settings_prueba, tidb, BaseFalsa())
    app.state.ejecutadas = []
    router = APIRouter(prefix="/api/prueba")

    @router.get("/{n}")
    def leer(n: int):
        return {"n": n}

    def escribir(cuerpo: Cuerpo):
        app.state.ejecutadas.append(cuerpo.n)
        return {"n": cuerpo.n}

    for metodo in ESCRITURAS:
        router.add_api_route("", escribir, methods=[metodo])
    app.include_router(router)

    @app.post("/api/directa")
    def directa():
        return {}

    @app.websocket("/ws")
    async def ws(websocket: WebSocket):
        await websocket.accept()
        await websocket.close()

    return app


@pytest.fixture
def cliente(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def como(app):
    """Encabezado Bearer de una cuenta: como(1, "admin")."""

    def _como(id_admin, rol):
        return {"Authorization": f"Bearer {app.state.tokens.crear(id_admin, rol)}"}

    return _como


# --- Sin sesión ----------------------------------------------------------------------


def test_todas_las_rutas_piden_sesion_salvo_las_publicas(app, cliente):
    revisadas, publicas = set(), set()
    for ruta, metodos in app.openapi()["paths"].items():
        for metodo in metodos:
            metodo = metodo.upper()
            revisadas.add((metodo, ruta))
            r = cliente.request(metodo, re.sub(r"\{.*?\}", "1", ruta), json=BUENO)
            if (metodo, ruta) in RUTAS_PUBLICAS:
                publicas.add((metodo, ruta))
                assert r.json() != SIN_SESION
            else:
                assert (metodo, ruta, r.status_code, r.json()) == (metodo, ruta, 401, SIN_SESION)
    # Las listas de excepciones corresponden a rutas reales
    assert publicas == RUTAS_PUBLICAS == {("GET", "/api/health"), ("POST", "/api/auth/login")}
    assert RUTAS_DE_AMBOS_ROLES == {("POST", "/api/auth/logout")}
    assert revisadas >= RUTAS_DE_AMBOS_ROLES | {("GET", "/api/auth/me"), ("POST", "/api/directa")}


def test_las_publicas_siguen_abiertas(cliente):
    assert cliente.get("/api/health").status_code == 200
    r = cliente.post("/api/auth/login", json={"correo": "ana@prueba.mx", "password": PASSWORD})
    assert r.status_code == 200


def test_publica_solo_con_su_metodo(app, cliente):
    # Si mañana existiera POST /api/health, no heredaría el permiso del GET
    @app.post("/api/health")
    def otra():
        return {}

    assert cliente.post("/api/health").status_code == 401


def test_token_revocado_no_lee_ni_escribe(app, cliente, como):
    cabecera = como(1, "admin")
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 200
    assert cliente.post("/api/auth/logout", headers=cabecera).status_code == 204
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 401
    assert cliente.post("/api/prueba", headers=cabecera, json=BUENO).status_code == 401
    assert app.state.ejecutadas == []


def test_funciona_con_cookie(cliente):
    cliente.post("/api/auth/login", json={"correo": "ana@prueba.mx", "password": PASSWORD})
    assert cliente.get("/api/prueba/1").status_code == 200
    assert cliente.post("/api/prueba", json=BUENO).status_code == 200


# --- Roles ---------------------------------------------------------------------------


@pytest.mark.parametrize("metodo", ESCRITURAS)
def test_analista_no_escribe(app, cliente, como, tidb, metodo):
    r = cliente.request(metodo, "/api/prueba", headers=como(2, "analista"), json=BUENO)
    assert r.status_code == 403
    assert r.json() == SIN_PERMISO
    assert app.state.ejecutadas == []
    assert tidb.conexiones == 0  # con el token basta para rechazarlo


def test_analista_lee_y_cierra_sesion(cliente, como):
    cabecera = como(2, "analista")
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 200
    assert cliente.get("/api/auth/me", headers=cabecera).status_code == 200
    assert cliente.post("/api/auth/logout", headers=cabecera).status_code == 204
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 401


@pytest.mark.parametrize("metodo", ESCRITURAS)
def test_admin_escribe(app, cliente, como, tidb, metodo):
    r = cliente.request(metodo, "/api/prueba", headers=como(1, "admin"), json=BUENO)
    assert r.status_code == 200
    assert app.state.ejecutadas == [1]
    assert tidb.conexiones == 1


def test_admin_lee(cliente, como):
    assert cliente.get("/api/prueba/1", headers=como(1, "admin")).status_code == 200


# --- La cuenta cambia con el token vigente -------------------------------------------


def test_cuenta_desactivada_lee_pero_no_escribe(app, cliente, como, tidb):
    cabecera = como(1, "admin")
    tidb.cuentas[0]["activo"] = 0
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 200
    assert tidb.conexiones == 0  # las lecturas confían en el token
    r = cliente.post("/api/prueba", headers=cabecera, json=BUENO)
    assert (r.status_code, r.json()) == (401, SIN_SESION)
    assert app.state.ejecutadas == []


def test_cuenta_borrada_no_escribe(app, cliente, como):
    r = cliente.post("/api/prueba", headers=como(99, "admin"), json=BUENO)
    assert (r.status_code, r.json()) == (401, SIN_SESION)
    assert app.state.ejecutadas == []


def test_admin_que_paso_a_analista_no_escribe(app, cliente, como, tidb):
    cabecera = como(1, "admin")
    tidb.cuentas[0]["rol"] = "analista"
    r = cliente.post("/api/prueba", headers=cabecera, json=BUENO)
    assert (r.status_code, r.json()) == (403, SIN_PERMISO)
    assert app.state.ejecutadas == []


def test_analista_que_paso_a_admin_debe_volver_a_entrar(app, cliente, como, tidb):
    cabecera = como(2, "analista")
    tidb.cuentas[1]["rol"] = "admin"
    assert cliente.post("/api/prueba", headers=cabecera, json=BUENO).status_code == 403
    r = cliente.post("/api/auth/login", json={"correo": "leo@prueba.mx", "password": PASSWORD})
    nueva = {"Authorization": f"Bearer {r.json()['token']}"}
    assert cliente.post("/api/prueba", headers=nueva, json=BUENO).status_code == 200


def test_tidb_caida_no_deja_escribir_pero_si_leer(app, cliente, como, tidb):
    cabecera = como(1, "admin")
    tidb.falla = pymysql.err.OperationalError(2003, "host privado")
    r = cliente.post("/api/prueba", headers=cabecera, json=BUENO)
    assert (r.status_code, r.json()) == (503, {"detail": "Base de datos no disponible"})
    assert app.state.ejecutadas == []
    assert cliente.get("/api/prueba/1", headers=cabecera).status_code == 200


# --- Orden de las revisiones ---------------------------------------------------------


def test_orden_401_403_422(cliente, como):
    assert cliente.post("/api/prueba", json=MALO).status_code == 401
    assert cliente.post("/api/prueba", headers=como(2, "analista"), json=MALO).status_code == 403
    assert cliente.post("/api/prueba", headers=como(1, "admin"), json=MALO).status_code == 422
    assert cliente.get("/api/prueba/texto").status_code == 401
    assert cliente.get("/api/prueba/texto", headers=como(2, "analista")).status_code == 422


def test_excepciones_del_orden(cliente):
    json_roto = {"content": "{", "headers": {"Content-Type": "application/json"}}
    assert cliente.post("/api/prueba", **json_roto).status_code == 422
    assert cliente.get("/api/no-existe").status_code == 404
    assert cliente.delete("/api/auth/me").status_code == 405


def test_websocket_no_pasa_por_esta_dependencia(cliente):
    with cliente.websocket_connect("/ws") as ws:
        assert ws.receive()["type"] == "websocket.close"
