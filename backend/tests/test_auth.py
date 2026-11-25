import logging
import time

import jwt
import pymysql
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.tokens import Tokens
from tests.conftest import CLAVE_PRUEBA, BaseFalsa
from tests.falsos import HASH, PASSWORD, TiDBFalsa

MAL_LOGIN = {"detail": "Correo o contraseña incorrectos"}
MALA_SESION = {"detail": "Sesión no válida o vencida"}
ADMIN = {"id_admin": 1, "nombre": "Ana", "correo": "ana@prueba.mx", "rol": "admin"}


@pytest.fixture
def tidb():
    return TiDBFalsa()


@pytest.fixture
def cliente(settings_prueba, tidb):
    app = create_app(settings_prueba, tidb, BaseFalsa())
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def tokens(cliente):
    return cliente.app.state.tokens


def entrar(cliente, correo="ana@prueba.mx", password=PASSWORD):
    return cliente.post("/api/auth/login", json={"correo": correo, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Login ---------------------------------------------------------------------------


def test_login_correcto(cliente, tidb):
    r = entrar(cliente, " ANA@Prueba.mx ")
    assert r.status_code == 200
    datos = r.json()
    token = datos.pop("token")
    assert datos == {"tipo": "bearer", "expira_en": 3600, "usuario": ADMIN}
    assert tidb.accesos == [1]
    assert r.headers["cache-control"] == "no-store"
    assert HASH not in r.text

    partes = [p.strip().lower() for p in r.headers["set-cookie"].split(";")]
    assert partes[0] == f"c360_token={token}".lower()
    assert {"httponly", "samesite=lax", "path=/", "max-age=3600"} <= set(partes)
    assert "secure" not in partes


def test_el_token_lleva_lo_del_contrato(cliente):
    token = entrar(cliente).json()["token"]
    datos = jwt.decode(token, CLAVE_PRUEBA, algorithms=["HS256"])
    assert set(datos) == {"sub", "rol", "jti", "exp"}
    assert (datos["sub"], datos["rol"]) == ("1", "admin")
    assert 3590 <= datos["exp"] - time.time() <= 3600
    otro = jwt.decode(entrar(cliente).json()["token"], CLAVE_PRUEBA, algorithms=["HS256"])
    assert otro["jti"] != datos["jti"]


@pytest.mark.parametrize(
    "correo, password",
    [
        ("nadie@prueba.mx", PASSWORD),
        ("ana@prueba.mx", "incorrecta-12345"),
        ("baja@prueba.mx", PASSWORD),
    ],
    ids=["correo inexistente", "password incorrecta", "cuenta inactiva"],
)
def test_login_401_siempre_igual(cliente, tidb, correo, password):
    r = entrar(cliente, correo, password)
    assert r.status_code == 401
    assert r.json() == MAL_LOGIN
    assert "set-cookie" not in r.headers
    assert tidb.accesos == []


def test_correo_inexistente_tambien_verifica_un_hash(cliente, monkeypatch):
    usados = []
    monkeypatch.setattr(
        "app.routers.auth.verificar_password", lambda p, h: usados.append(h) or False
    )
    entrar(cliente, "nadie@prueba.mx")
    assert len(usados) == 1 and usados[0].startswith("$argon2id$") and usados[0] != HASH


def test_login_con_hash_danado_da_401(cliente, tidb):
    tidb.cuentas[0]["password_hash"] = "texto"
    assert entrar(cliente).status_code == 401


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"password": PASSWORD},
        {"correo": "ana@prueba.mx"},
        {"correo": "sin-arroba", "password": PASSWORD},
        {"correo": "josé@prueba.mx", "password": PASSWORD},
        {"correo": "ana@prueba.mx", "password": ""},
        {"correo": "ana@prueba.mx", "password": PASSWORD + "x" * 1024},
        {"correo": "ana@prueba.mx", "password": [PASSWORD]},
        [PASSWORD],
    ],
)
def test_login_422_no_devuelve_lo_enviado(cliente, tidb, caplog, cuerpo):
    with caplog.at_level(logging.DEBUG):
        r = cliente.post("/api/auth/login", json=cuerpo)
    assert r.status_code == 422
    assert PASSWORD not in r.text
    assert PASSWORD not in caplog.text
    assert all(set(e) == {"type", "loc", "msg"} for e in r.json()["detail"])
    assert tidb.accesos == []


def test_login_json_mal_formado_no_devuelve_lo_enviado(cliente):
    r = cliente.post(
        "/api/auth/login",
        content=f'{{"correo": "ana@prueba.mx", "password": "{PASSWORD}',
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422
    assert PASSWORD not in r.text


def test_password_de_1024_llega_a_verificarse(cliente):
    assert entrar(cliente, password="x" * 1024).status_code == 401
    assert entrar(cliente, password="x" * 1025).status_code == 422


# --- me ------------------------------------------------------------------------------


def test_me_con_cookie(cliente):
    entrar(cliente)
    r = cliente.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json() == ADMIN


def test_me_con_bearer(cliente, tokens):
    r = cliente.get("/api/auth/me", headers=bearer(tokens.crear(2, "analista")))
    assert r.status_code == 200
    assert r.json()["rol"] == "analista"


def test_me_cuenta_desactivada_o_borrada(cliente, tidb, tokens):
    cabecera = bearer(tokens.crear(1, "admin"))
    tidb.cuentas[0]["activo"] = 0
    assert cliente.get("/api/auth/me", headers=cabecera).status_code == 401
    del tidb.cuentas[0]
    r = cliente.get("/api/auth/me", headers=cabecera)
    assert r.status_code == 401
    assert r.json() == MALA_SESION


# --- Token ---------------------------------------------------------------------------


def token_con(clave=CLAVE_PRUEBA, algoritmo="HS256", quitar=(), **cambios):
    datos = {"sub": "1", "rol": "admin", "jti": "abc", "exp": int(time.time()) + 60, **cambios}
    for campo in quitar:
        del datos[campo]
    return jwt.encode(datos, clave, algorithm=algoritmo)


def test_el_token_de_prueba_base_si_es_valido(cliente):
    # Control: así se sabe que los de abajo fallan por el cambio y no por otra cosa
    assert cliente.get("/api/auth/me", headers=bearer(token_con())).status_code == 200


TOKENS_MALOS = {
    "vacio": lambda: "",
    "basura": lambda: "no-es-un-token",
    "vencido": lambda: token_con(exp=int(time.time()) - 1),
    "otra clave": lambda: token_con(clave="otra-clave-de-mas-de-32-caracteres-000"),
    "otro algoritmo": lambda: token_con(clave=CLAVE_PRUEBA * 2, algoritmo="HS512"),
    "sin firma": lambda: token_con(clave="", algoritmo="none"),
    "sin sub": lambda: token_con(quitar=["sub"]),
    "sin rol": lambda: token_con(quitar=["rol"]),
    "sin jti": lambda: token_con(quitar=["jti"]),
    "sin exp": lambda: token_con(quitar=["exp"]),
    "sub no numerico": lambda: token_con(sub="uno"),
    "rol desconocido": lambda: token_con(rol="root"),
}


@pytest.mark.parametrize("caso", TOKENS_MALOS)
def test_token_malo_da_401(cliente, caso):
    cabecera = bearer(TOKENS_MALOS[caso]())
    for r in (
        cliente.get("/api/auth/me", headers=cabecera),
        cliente.post("/api/auth/logout", headers=cabecera),
    ):
        assert r.status_code == 401
        assert r.json() == MALA_SESION
        assert r.headers["www-authenticate"] == "Bearer"


def test_contenido_alterado_da_401(cliente, tokens):
    cabeza, _, firma = tokens.crear(2, "analista").split(".")
    _, cuerpo_admin, _ = tokens.crear(1, "admin").split(".")
    r = cliente.get("/api/auth/me", headers=bearer(f"{cabeza}.{cuerpo_admin}.{firma}"))
    assert r.status_code == 401


def test_sin_token_da_401(cliente):
    assert cliente.get("/api/auth/me").status_code == 401
    assert cliente.post("/api/auth/logout").status_code == 401


def test_bearer_gana_a_la_cookie(cliente, tokens):
    entrar(cliente)  # cookie del admin
    r = cliente.get("/api/auth/me", headers=bearer(tokens.crear(2, "analista")))
    assert r.json()["id_admin"] == 2


@pytest.mark.parametrize("valor", ["Bearer no-es-un-token", "Bearer ", "Bearer", "bearer x"])
def test_bearer_malo_no_cae_a_la_cookie(cliente, valor):
    entrar(cliente)
    r = cliente.get("/api/auth/me", headers={"Authorization": valor})
    assert r.status_code == 401


def test_otro_esquema_usa_la_cookie(cliente):
    entrar(cliente)
    r = cliente.get("/api/auth/me", headers={"Authorization": "Basic YTpi"})
    assert r.status_code == 200


# --- Logout --------------------------------------------------------------------------


def test_logout_revoca_el_token_y_borra_la_cookie(cliente):
    token = entrar(cliente).json()["token"]
    r = cliente.post("/api/auth/logout")
    assert r.status_code == 204
    assert r.content == b""
    assert 'c360_token=""' in r.headers["set-cookie"]
    assert "max-age=0" in r.headers["set-cookie"].lower()
    assert "c360_token" not in cliente.cookies
    # El mismo token ya no sirve por ninguna de las dos vías
    assert cliente.get("/api/auth/me", headers=bearer(token)).status_code == 401
    cliente.cookies.set("c360_token", token)
    assert cliente.get("/api/auth/me").status_code == 401
    assert cliente.post("/api/auth/logout").status_code == 401


def test_logout_no_afecta_otras_sesiones(cliente, tokens):
    uno, dos = tokens.crear(1, "admin"), tokens.crear(1, "admin")
    assert cliente.post("/api/auth/logout", headers=bearer(uno)).status_code == 204
    assert cliente.get("/api/auth/me", headers=bearer(dos)).status_code == 200


def test_los_revocados_vencidos_se_limpian(settings_prueba, monkeypatch):
    tokens = Tokens(settings_prueba)
    viejo = tokens.validar(tokens.crear(1, "admin"))
    nuevo = tokens.validar(tokens.crear(1, "admin"))
    tokens.revocar(viejo)
    monkeypatch.setattr("app.tokens.time.time", lambda: viejo.exp + 1)
    tokens.revocar(nuevo)
    assert set(tokens._revocados) == {nuevo.jti}


# --- TiDB caída y privacidad ---------------------------------------------------------


@pytest.mark.parametrize("error", [pymysql.err.OperationalError, pymysql.err.InterfaceError])
def test_tidb_caida_da_503(cliente, tidb, tokens, caplog, error):
    cabecera = bearer(tokens.crear(1, "admin"))
    tidb.falla = error(2003, "host privado")
    for r in (entrar(cliente), cliente.get("/api/auth/me", headers=cabecera)):
        assert r.status_code == 503
        assert r.json() == {"detail": "Base de datos no disponible"}
        assert "set-cookie" not in r.headers
    assert "host privado" not in caplog.text
    # Cerrar sesión no necesita a TiDB
    assert cliente.post("/api/auth/logout", headers=cabecera).status_code == 204


def test_nada_secreto_en_los_logs(cliente, caplog, capsys):
    with caplog.at_level(logging.DEBUG):
        token = entrar(cliente).json()["token"]
        entrar(cliente, password="incorrecta-12345")
        cliente.get("/api/auth/me")
        cliente.post("/api/auth/logout")
    salida = capsys.readouterr()
    for texto in (caplog.text, salida.out, salida.err):
        for secreto in (PASSWORD, "incorrecta-12345", token, HASH, CLAVE_PRUEBA):
            assert secreto not in texto
