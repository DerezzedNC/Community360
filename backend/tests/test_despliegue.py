"""F8-01: la API sirve el build del frontend y la cookie lleva Secure en producción."""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import BaseFalsa
from tests.falsos import PASSWORD, TiDBFalsa

INDICE = "<!doctype html><title>COMMUNITY 360</title>"
SCRIPT = "console.log('c360')"


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(INDICE, encoding="utf-8")
    (tmp_path / "assets" / "app-1a2b.js").write_text(SCRIPT, encoding="utf-8")
    (tmp_path / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    return tmp_path


@pytest.fixture
def cliente(settings_prueba, dist):
    settings = settings_prueba.model_copy(update={"FRONTEND_DIST": dist})
    app = create_app(settings, TiDBFalsa(), BaseFalsa())
    return TestClient(app, raise_server_exceptions=False)


# --- Archivos del frontend y respaldo a index.html ----------------------------------


@pytest.mark.parametrize("ruta", ["/", "/login", "/dashboard", "/usuarios/U0001?pagina=2"])
def test_rutas_del_frontend_devuelven_index(cliente, ruta):
    r = cliente.get(ruta)
    assert r.status_code == 200
    assert r.text == INDICE
    assert r.headers["content-type"].startswith("text/html")
    assert r.headers["cache-control"] == "no-cache"


def test_archivos_estaticos(cliente):
    r = cliente.get("/assets/app-1a2b.js")
    assert r.status_code == 200 and r.text == SCRIPT
    assert cliente.get("/favicon.svg").text == "<svg/>"
    # Un asset que no existe no se cambia por index.html
    assert cliente.get("/assets/no-existe.js").status_code == 404


def test_no_sale_de_la_carpeta_dist(cliente):
    r = cliente.get("/%2e%2e/%2e%2e/conftest.py")
    assert r.status_code in (200, 404)
    assert "import" not in r.text


@pytest.mark.parametrize("ruta", ["/api", "/api/no-existe", "/ws", "/ws/otra"])
def test_api_y_ws_siguen_con_su_404(cliente, ruta):
    r = cliente.get(ruta)
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}


def test_la_proteccion_de_la_api_no_cambia(cliente):
    assert cliente.get("/api/catalogos").status_code == 401
    assert cliente.delete("/api/auth/me").status_code == 405
    assert cliente.post("/dashboard").status_code == 404  # solo GET y HEAD sirven el frontend


def test_sin_build_no_hay_respaldo(settings_prueba):
    app = create_app(settings_prueba, BaseFalsa(), BaseFalsa())
    cliente = TestClient(app, raise_server_exceptions=False)
    assert cliente.get("/dashboard").status_code == 404


# --- Cookie con COOKIE_SECURE --------------------------------------------------------


def partes_cookie(respuesta):
    return {p.strip().lower() for p in respuesta.headers["set-cookie"].split(";")}


@pytest.mark.parametrize("secure", [True, False])
def test_cookie_secure_en_login_y_logout(settings_prueba, secure):
    settings = settings_prueba.model_copy(update={"COOKIE_SECURE": secure})
    cliente = TestClient(create_app(settings, TiDBFalsa(), BaseFalsa()))

    r = cliente.post("/api/auth/login", json={"correo": "ana@prueba.mx", "password": PASSWORD})
    assert r.status_code == 200
    assert ("secure" in partes_cookie(r)) is secure
    assert {"httponly", "samesite=lax", "path=/"} <= partes_cookie(r)

    # Bearer: el cliente de pruebas usa http y no reenviaría una cookie Secure
    salida = cliente.post(
        "/api/auth/logout", headers={"Authorization": f"Bearer {r.json()['token']}"}
    )
    assert salida.status_code == 204
    assert ("secure" in partes_cookie(salida)) is secure


def test_cookie_secure_se_lee_del_entorno(settings_prueba, monkeypatch):
    monkeypatch.setenv("COOKIE_SECURE", "true")
    settings = type(settings_prueba)(_env_file=None, **{
        k: v for k, v in settings_prueba.model_dump().items() if k != "COOKIE_SECURE"
    })
    assert settings.COOKIE_SECURE is True
