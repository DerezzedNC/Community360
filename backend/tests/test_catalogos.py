"""GET /api/catalogos (contrato v0.5)."""
import re
from contextlib import contextmanager

import pymysql
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositorios.catalogos import CATALOGOS, CONSULTA
from tests.conftest import BaseFalsa

LLAVES = {
    "rango_edad", "especie", "interes", "plataforma",
    "tema", "etiqueta", "tipo_interaccion", "dispositivo",
}


def fila(catalogo, codigo, nombre, activo=1, extra=None):
    # Como las devuelve PyMySQL: los BOOLEAN de TiDB llegan como 0 o 1
    return {"catalogo": catalogo, "codigo": codigo, "nombre": nombre, "extra": extra, "activo": activo}


FILAS = [
    fila("dispositivo", "android", "Android"),
    fila("especie", "dragon", "Dragón"),
    fila("especie", "lobo", "Lobo", activo=0),
    fila("etiqueta", "arte", "Arte"),
    fila("interes", "musica", "Música"),
    fila("plataforma", "discord", "Discord"),
    fila("rango_edad", "18_24", "18-24"),
    fila("rango_edad", "39_mas", "39+"),
    fila("tema", "musica", "Música"),
    fila("tipo_interaccion", "comentario", "Comentario", extra=1),
    fila("tipo_interaccion", "reaccion", "Reacción", extra=0),
]


class TiDBCatalogos(BaseFalsa):
    """Devuelve FILAS a la consulta de catálogos. Nunca se conecta a nada."""

    def __init__(self, filas=FILAS):
        super().__init__()
        self.filas = filas
        self.consultas = []
        self.falla = None

    @contextmanager
    def conexion(self):
        if self.falla:
            raise self.falla
        yield self

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros=None):
        self.consultas.append(sql)

    def fetchall(self):
        return list(self.filas)


@pytest.fixture
def tidb():
    return TiDBCatalogos()


@pytest.fixture
def app(settings_prueba, tidb):
    return create_app(settings_prueba, tidb, BaseFalsa())


@pytest.fixture
def cliente(app):
    return TestClient(app, raise_server_exceptions=False)


def sesion(app, rol):
    return {"Authorization": f"Bearer {app.state.tokens.crear(1, rol)}"}


@pytest.mark.parametrize("rol", ["admin", "analista"])
def test_ambos_roles_consultan(app, cliente, rol):
    r = cliente.get("/api/catalogos", headers=sesion(app, rol))
    assert r.status_code == 200
    assert set(r.json()) == LLAVES


def test_formato_del_contrato(app, cliente):
    r = cliente.get("/api/catalogos", headers=sesion(app, "analista")).json()
    assert r["rango_edad"] == [
        {"codigo": "18_24", "descripcion": "18-24", "activo": True},
        {"codigo": "39_mas", "descripcion": "39+", "activo": True},
    ]
    assert r["tipo_interaccion"] == [
        {"codigo": "comentario", "nombre": "Comentario", "admite_texto": True, "activo": True},
        {"codigo": "reaccion", "nombre": "Reacción", "admite_texto": False, "activo": True},
    ]
    assert r["plataforma"] == [{"codigo": "discord", "nombre": "Discord", "activo": True}]
    # admite_texto solo en tipo_interaccion y descripcion solo en rango_edad
    for llave, lista in r.items():
        for item in lista:
            esperadas = {"codigo", "activo"}
            esperadas |= {"descripcion"} if llave == "rango_edad" else {"nombre"}
            esperadas |= {"admite_texto"} if llave == "tipo_interaccion" else set()
            assert set(item) == esperadas, llave


def test_incluye_inactivos_con_activo_false(app, cliente):
    r = cliente.get("/api/catalogos", headers=sesion(app, "analista")).json()
    assert r["especie"] == [
        {"codigo": "dragon", "nombre": "Dragón", "activo": True},
        {"codigo": "lobo", "nombre": "Lobo", "activo": False},
    ]


def test_catalogo_vacio_llega_como_lista_vacia(settings_prueba):
    sin_etiquetas = [f for f in FILAS if f["catalogo"] != "etiqueta"]
    app = create_app(settings_prueba, TiDBCatalogos(sin_etiquetas), BaseFalsa())
    r = TestClient(app).get("/api/catalogos", headers=sesion(app, "analista"))
    assert r.status_code == 200
    assert r.json()["etiqueta"] == []
    assert set(r.json()) == LLAVES


def test_sin_sesion_401(cliente, tidb):
    r = cliente.get("/api/catalogos")
    assert r.status_code == 401
    assert r.json() == {"detail": "Sesión no válida o vencida"}
    assert tidb.consultas == []  # no llegó a TiDB


@pytest.mark.parametrize("error", [pymysql.err.OperationalError, pymysql.err.InterfaceError])
def test_tidb_caida_503(app, cliente, tidb, error):
    tidb.falla = error(2003, "detalle privado del servidor")
    r = cliente.get("/api/catalogos", headers=sesion(app, "analista"))
    assert r.status_code == 503
    assert r.json() == {"detail": "Base de datos no disponible"}


def test_no_se_puede_escribir(app, cliente):
    # Ruta de solo lectura: ni el admin puede mandar un POST
    assert cliente.post("/api/catalogos", headers=sesion(app, "admin")).status_code == 405


def test_una_sola_consulta_de_lectura_sin_geografia(app, cliente, tidb):
    cliente.get("/api/catalogos", headers=sesion(app, "analista"))
    assert tidb.consultas == [CONSULTA]
    assert set(CATALOGOS) == LLAVES
    assert CONSULTA.startswith("SELECT ") and ";" not in CONSULTA
    assert not re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b", CONSULTA, re.I)
    assert not re.search(r"\b(pais|estado|ciudad|ubicacion_usuario|latitud|longitud)\b", CONSULTA)
    assert CONSULTA.endswith("ORDER BY catalogo, codigo")
    assert CONSULTA.count("UNION ALL") == len(LLAVES) - 1


@pytest.mark.nube
def test_catalogos_con_tidb_real():
    """Solo lectura contra la base real."""
    app = create_app()
    with TestClient(app) as cliente:
        r = cliente.get("/api/catalogos", headers=sesion(app, "analista"))
    assert r.status_code == 200
    datos = r.json()
    assert set(datos) == LLAVES
    for llave, lista in datos.items():
        assert lista, f"{llave} vacío"
        codigos = [i["codigo"] for i in lista]
        assert codigos == sorted(codigos), f"{llave} sin ordenar"
        assert all(re.fullmatch(r"[a-z0-9_]+", c) for c in codigos)
    reaccion = next(t for t in datos["tipo_interaccion"] if t["codigo"] == "reaccion")
    assert reaccion["admite_texto"] is False
