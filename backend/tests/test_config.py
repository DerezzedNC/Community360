import pytest

from app.config import ErrorConfiguracion, cargar_settings
from tests.conftest import CLAVE_PRUEBA

VARIABLES = [
    "TIDB_HOST", "TIDB_USER", "TIDB_PASSWORD", "CB_CONN", "CB_USER", "CB_PASSWORD", "JWT_SECRET",
]


@pytest.fixture(autouse=True)
def sin_variables_del_sistema(monkeypatch):
    for nombre in VARIABLES:
        monkeypatch.delenv(nombre, raising=False)


def test_variable_faltante_muestra_solo_el_nombre():
    with pytest.raises(ErrorConfiguracion) as e:
        cargar_settings(_env_file=None, TIDB_PASSWORD=CLAVE_PRUEBA)
    assert "TIDB_HOST" in str(e.value)
    assert "TIDB_PASSWORD" not in str(e.value)
    assert CLAVE_PRUEBA not in str(e.value)


def test_jwt_secret_corto_se_rechaza_sin_mostrarlo():
    with pytest.raises(ErrorConfiguracion) as e:
        cargar_settings(_env_file=None, JWT_SECRET="corta-123")
    assert "JWT_SECRET" in str(e.value)
    assert "corta-123" not in str(e.value)


def test_las_claves_no_salen_al_imprimir(settings_prueba):
    assert CLAVE_PRUEBA not in repr(settings_prueba)
