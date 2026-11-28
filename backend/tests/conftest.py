from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

CLAVE_PRUEBA = "clave-falsa-solo-para-pruebas-1234567890"


class BaseFalsa:
    """Sustituye a TiDB o Capella para probar sin red."""

    def __init__(self, responde: bool = True):
        self.responde = responde

    def probar(self) -> bool:
        return self.responde

    def conectar(self, esperar: float = 0) -> bool:
        return self.responde

    def cerrar(self) -> None:
        pass


@pytest.fixture
def settings_prueba() -> Settings:
    # _env_file=None: estas pruebas no leen el .env real
    return Settings(
        _env_file=None,
        TIDB_HOST="tidb.invalid", TIDB_USER="prueba", TIDB_PASSWORD=CLAVE_PRUEBA,
        CB_CONN="couchbases://cb.invalid", CB_USER="prueba", CB_PASSWORD=CLAVE_PRUEBA,
        JWT_SECRET=CLAVE_PRUEBA,
        # Sin build del frontend: así las pruebas no dependen de frontend/dist
        FRONTEND_DIST=Path(__file__).parent / "sin_frontend",
    )


@pytest.fixture
def crear_cliente(settings_prueba):
    def _crear(tidb: bool = True, capella: bool = True) -> TestClient:
        app = create_app(settings_prueba, BaseFalsa(tidb), BaseFalsa(capella))
        return TestClient(app, raise_server_exceptions=False)

    return _crear
