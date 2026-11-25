import threading
import time
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.db.capella import Capella
from app.db.tidb import TiDB
from app.main import create_app
from tests.conftest import CLAVE_PRUEBA, BaseFalsa


def test_health_todo_bien(crear_cliente):
    r = crear_cliente().get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "tidb": True, "capella": True}


@pytest.mark.parametrize("tidb, capella", [(False, True), (True, False), (False, False)])
def test_health_degradado(crear_cliente, tidb, capella):
    r = crear_cliente(tidb, capella).get("/api/health")
    assert r.status_code == 503
    assert r.json() == {"estado": "degradado", "tidb": tidb, "capella": capella}


def test_falla_de_conexion_no_filtra_claves(settings_prueba, monkeypatch, caplog):
    def falla(*args, **kwargs):
        raise RuntimeError(f"la clave es {CLAVE_PRUEBA}")

    monkeypatch.setattr("app.db.tidb.pymysql.connect", falla)
    monkeypatch.setattr("app.db.capella.Cluster", falla)
    app = create_app(settings_prueba, TiDB(settings_prueba), Capella(settings_prueba))
    with TestClient(app) as cliente:
        r = cliente.get("/api/health")
    assert r.status_code == 503
    assert r.json() == {"estado": "degradado", "tidb": False, "capella": False}
    assert CLAVE_PRUEBA not in caplog.text


def test_capella_no_reintenta_en_cada_peticion(settings_prueba, monkeypatch):
    intentos = []

    def falla(*args, **kwargs):
        intentos.append(1)
        raise RuntimeError("sin red")

    monkeypatch.setattr("app.db.capella.Cluster", falla)
    capella = Capella(settings_prueba)
    assert capella.conectar(esperar=5) is False
    assert capella.probar() is False
    assert capella.probar() is False
    assert len(intentos) == 1


def test_capella_lenta_no_bloquea(settings_prueba, monkeypatch):
    soltar = threading.Event()

    def lenta(*args, **kwargs):
        soltar.wait(10)
        raise RuntimeError("sin red")

    monkeypatch.setattr("app.db.capella.Cluster", lenta)
    capella = Capella(settings_prueba)
    inicio = time.monotonic()
    assert capella.conectar(esperar=0.1) is False
    assert capella.probar() is False
    assert time.monotonic() - inicio < 2
    soltar.set()


def test_capella_se_recupera(settings_prueba, monkeypatch):
    cluster = MagicMock()
    respuestas = iter([RuntimeError("apagado"), cluster])

    def conecta(*args, **kwargs):
        r = next(respuestas)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr("app.db.capella.Cluster", conecta)
    monkeypatch.setattr("app.db.capella.SEGUNDOS_ENTRE_REINTENTOS", 0)
    capella = Capella(settings_prueba)
    assert capella.conectar(esperar=5) is False
    assert capella.conectar(esperar=5) is True
    assert capella.probar() is True
    capella.cerrar()
    cluster.close.assert_called_once()


def test_la_api_levanta_aunque_capella_no_responda(settings_prueba):
    app = create_app(settings_prueba, BaseFalsa(), BaseFalsa(responde=False))
    with TestClient(app) as cliente:  # "with" ejecuta el arranque y el cierre
        assert cliente.get("/api/health").status_code == 503


def test_error_interno_con_formato_del_contrato(crear_cliente):
    cliente = crear_cliente()

    def revienta():
        raise RuntimeError("detalle privado")

    cliente.app.state.tidb.probar = revienta
    r = cliente.get("/api/health")
    assert r.status_code == 500
    assert r.json() == {"detail": "Error interno del servidor"}


@pytest.mark.nube
def test_health_con_bases_reales():
    with TestClient(create_app()) as cliente:
        r = cliente.get("/api/health")
    assert r.json() == {"estado": "ok", "tidb": True, "capella": True}
    assert r.status_code == 200
