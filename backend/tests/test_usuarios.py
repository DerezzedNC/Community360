"""GET /api/usuarios y GET /api/usuarios/{id_usuario} (contrato v0.6)."""
import re
from contextlib import contextmanager
from datetime import date
from decimal import Decimal

import pymysql
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.repositorios import usuarios
from tests.conftest import BaseFalsa

LLAVES_USUARIO = set(usuarios.COLUMNAS) | {"ubicacion"}
LLAVES_UBICACION = {"pais", "estado", "ciudad", "zona_horaria"}
PROHIBIDAS = {"latitud", "longitud", "creado_en", "actualizado_en", "id_ciudad"}


def fila(id_usuario, consentimiento=1, estatus="activo", plataforma="discord", ubicacion=True):
    """Como la devuelve PyMySQL después de los JOIN."""
    f = {
        "id_usuario": id_usuario, "alias": f"alias_{id_usuario}", "fecha_ingreso": date(2024, 1, 2),
        "cod_rango_edad": "18_24", "cod_especie": "lobo", "cod_interes": "musica",
        "cod_plataforma": plataforma, "es_artista": 1, "mensajes_30d": 3, "reacciones_30d": 4,
        "eventos_asistidos": 0, "comisiones_compradas": 1, "sentimiento_promedio": Decimal("0.250"),
        "ultima_actividad": date(2026, 11, 1), "estatus": estatus,
        "consentimiento_datos": consentimiento, "es_atipico": 0,
        "pais": None, "estado": None, "ciudad": None, "zona_horaria": None,
    }
    if ubicacion:
        f.update(pais="México", estado="Yucatán", ciudad="Mérida", zona_horaria="America/Merida",
                 latitud=Decimal("20.967"), longitud=Decimal("-89.623"))
    return f


FILAS = [
    fila("U000001"),
    # Sin consentimiento pero con una ubicación sobrante, como si la primera capa (SQL) fallara
    fila("U000002", consentimiento=0, estatus="en_riesgo"),
    fila("U000003", consentimiento=0, estatus="inactivo", ubicacion=False),
    fila("U000004", plataforma="telegram"),
    fila("U000005", estatus="en_riesgo", plataforma="telegram"),
]


class TiDBUsuarios(BaseFalsa):
    """Aplica en memoria los filtros que la consulta manda como parámetros."""

    def __init__(self, filas=FILAS):
        super().__init__()
        self.filas = filas
        self.consultas = []
        self.falla = None
        self._resultado = None

    @contextmanager
    def conexion(self):
        if self.falla:
            raise self.falla
        yield self

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros):
        assert sql.count("%s") == len(parametros)
        self.consultas.append((sql, list(parametros)))
        condiciones = re.findall(r"u\.(\w+) = %s", sql)
        filas = [
            f for f in self.filas
            if all(f[col] == valor for col, valor in zip(condiciones, parametros))
        ]
        if sql.startswith("SELECT COUNT(*)"):
            self._resultado = [{"total": len(filas)}]
        elif "LIMIT %s OFFSET %s" in sql:
            limite, desde = parametros[-2:]
            self._resultado = sorted(filas, key=lambda f: f["id_usuario"])[desde:desde + limite]
        else:
            self._resultado = filas

    def fetchone(self):
        return self._resultado[0] if self._resultado else None

    def fetchall(self):
        return self._resultado


@pytest.fixture
def tidb():
    return TiDBUsuarios()


@pytest.fixture
def app(settings_prueba, tidb):
    return create_app(settings_prueba, tidb, BaseFalsa())


@pytest.fixture
def cliente(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def como(app):
    def _como(rol="analista"):
        return {"Authorization": f"Bearer {app.state.tokens.crear(1, rol)}"}
    return _como


def pedir(cliente, como, ruta, **params):
    return cliente.get(ruta, headers=como(), params=params)


# --- Privacidad ----------------------------------------------------------------------


def test_sin_consentimiento_no_hay_ubicacion_en_la_lista(cliente, como):
    datos = {u["id_usuario"]: u for u in pedir(cliente, como, "/api/usuarios").json()["datos"]}
    assert datos["U000002"]["consentimiento_datos"] is False
    assert datos["U000002"]["ubicacion"] is None  # aunque la fila traía ubicación
    assert datos["U000003"]["ubicacion"] is None
    assert datos["U000001"]["ubicacion"] == {
        "pais": "México", "estado": "Yucatán", "ciudad": "Mérida", "zona_horaria": "America/Merida",
    }


def test_sin_consentimiento_no_hay_ubicacion_en_el_detalle(cliente, como):
    r = pedir(cliente, como, "/api/usuarios/U000002")
    assert r.status_code == 200
    assert r.json()["ubicacion"] is None
    assert "Mérida" not in r.text and "Yucatán" not in r.text


def test_nunca_hay_coordenadas(cliente, como):
    for ruta in ("/api/usuarios", "/api/usuarios/U000001"):
        r = pedir(cliente, como, ruta)
        assert r.status_code == 200
        for prohibida in PROHIBIDAS:
            assert prohibida not in r.text, (ruta, prohibida)
        assert "20.967" not in r.text and "-89.623" not in r.text


def test_la_consulta_une_la_ubicacion_solo_con_consentimiento():
    # Primera capa: la condición va en el ON del LEFT JOIN, no en el WHERE
    sql = usuarios.SELECT_USUARIO
    assert re.search(
        r"LEFT JOIN ubicacion_usuario uu ON uu\.id_usuario = u\.id_usuario "
        r"AND u\.consentimiento_datos = TRUE LEFT JOIN", sql)
    assert not re.search(r"\b(latitud|longitud)\b", sql)
    assert "*" not in sql


def test_sin_filtro_ni_orden_por_ubicacion(cliente, como, tidb):
    r = pedir(cliente, como, "/api/usuarios", ciudad="Mérida", estado="Yucatán", pais="México",
              orden="ciudad")
    assert r.status_code == 200
    assert r.json()["total"] == len(FILAS)  # se ignoran
    for sql, _ in tidb.consultas:
        assert "ORDER BY u.id_usuario LIMIT" in sql or sql.startswith("SELECT COUNT(*)")
        assert not re.search(r"WHERE.*\b(p|e|c|uu)\.", sql)


# --- Formato -------------------------------------------------------------------------


@pytest.mark.parametrize("rol", ["admin", "analista"])
def test_ambos_roles_consultan(cliente, como, rol):
    assert cliente.get("/api/usuarios", headers=como(rol)).status_code == 200
    assert cliente.get("/api/usuarios/U000001", headers=como(rol)).status_code == 200


def test_formato_de_la_lista(cliente, como):
    r = pedir(cliente, como, "/api/usuarios").json()
    assert set(r) == {"total", "pagina", "limite", "datos"}
    assert (r["total"], r["pagina"], r["limite"]) == (5, 1, 50)
    u = r["datos"][0]
    assert set(u) == LLAVES_USUARIO
    assert set(u["ubicacion"]) == LLAVES_UBICACION
    assert u["fecha_ingreso"] == "2024-01-02" and u["ultima_actividad"] == "2026-11-01"
    assert u["sentimiento_promedio"] == 0.25
    assert u["es_artista"] is True and u["es_atipico"] is False


def test_detalle_igual_a_la_lista(cliente, como):
    lista = pedir(cliente, como, "/api/usuarios").json()["datos"]
    for u in lista:
        assert pedir(cliente, como, f"/api/usuarios/{u['id_usuario']}").json() == u


def test_detalle_no_existe_404(cliente, como):
    r = pedir(cliente, como, "/api/usuarios/U999999")
    assert r.status_code == 404
    assert r.json() == {"detail": "Usuario no encontrado"}


@pytest.mark.parametrize("id_malo", ["U1", "u000001", "X000001", "U0000000001", "U00000A"])
def test_detalle_id_invalido_422(cliente, como, tidb, id_malo):
    assert pedir(cliente, como, f"/api/usuarios/{id_malo}").status_code == 422
    assert tidb.consultas == []


# --- Paginación ----------------------------------------------------------------------


def test_paginas(cliente, como):
    p1 = pedir(cliente, como, "/api/usuarios", limite=2).json()
    p3 = pedir(cliente, como, "/api/usuarios", limite=2, pagina=3).json()
    assert [u["id_usuario"] for u in p1["datos"]] == ["U000001", "U000002"]
    assert [u["id_usuario"] for u in p3["datos"]] == ["U000005"]
    assert p3["total"] == 5 and p3["pagina"] == 3 and p3["limite"] == 2


def test_pagina_despues_de_la_ultima(cliente, como, tidb):
    r = pedir(cliente, como, "/api/usuarios", pagina=99999999999)
    assert r.status_code == 200
    assert r.json()["datos"] == [] and r.json()["total"] == 5
    assert len(tidb.consultas) == 1  # solo el COUNT: no se manda el OFFSET


@pytest.mark.parametrize("params", [
    {"pagina": 0}, {"pagina": -1}, {"limite": 0}, {"limite": 201}, {"limite": 1000},
    {"pagina": "uno"}, {"limite": "1.5"},
])
def test_fuera_de_rango_422_sin_recortar(cliente, como, tidb, params):
    r = pedir(cliente, como, "/api/usuarios", **params)
    assert r.status_code == 422
    assert tidb.consultas == []


def test_limite_maximo_200(cliente, como):
    assert pedir(cliente, como, "/api/usuarios", limite=200).json()["limite"] == 200


# --- Filtros -------------------------------------------------------------------------


def test_filtros_combinados(cliente, como, tidb):
    r = pedir(cliente, como, "/api/usuarios", estatus="en_riesgo", plataforma="telegram").json()
    assert r["total"] == 1
    assert [u["id_usuario"] for u in r["datos"]] == ["U000005"]
    sql, parametros = tidb.consultas[0]
    assert sql == ("SELECT COUNT(*) AS total FROM usuario u "
                   "WHERE u.estatus = %s AND u.cod_plataforma = %s")
    assert parametros == ["en_riesgo", "telegram"]


def test_filtro_especie_e_interes_van_como_parametros(cliente, como, tidb):
    pedir(cliente, como, "/api/usuarios", especie="lobo", interes="musica")
    sql, parametros = tidb.consultas[0]
    assert "u.cod_especie = %s AND u.cod_interes = %s" in sql
    assert parametros == ["lobo", "musica"]


def test_codigo_que_no_existe_da_lista_vacia(cliente, como):
    r = pedir(cliente, como, "/api/usuarios", plataforma="myspace")
    assert r.status_code == 200
    assert r.json()["total"] == 0 and r.json()["datos"] == []


@pytest.mark.parametrize("params", [
    {"estatus": "baneado"}, {"estatus": ""}, {"plataforma": "Discord"},
    {"especie": "lobo'; DROP TABLE usuario; --"}, {"interes": "x" * 31}, {"plataforma": ""},
])
def test_filtro_invalido_422(cliente, como, tidb, params):
    r = pedir(cliente, como, "/api/usuarios", **params)
    assert r.status_code == 422
    assert tidb.consultas == []
    assert "DROP" not in r.text  # el 422 no devuelve lo que mandó el cliente


# --- Errores comunes -----------------------------------------------------------------


@pytest.mark.parametrize("ruta", ["/api/usuarios", "/api/usuarios/U000001"])
def test_sin_sesion_401(cliente, tidb, ruta):
    r = cliente.get(ruta)
    assert r.status_code == 401
    assert r.json() == {"detail": "Sesión no válida o vencida"}
    assert tidb.consultas == []


@pytest.mark.parametrize("ruta", ["/api/usuarios", "/api/usuarios/U000001"])
def test_tidb_caida_503(cliente, como, tidb, ruta):
    tidb.falla = pymysql.err.OperationalError(2003, "detalle privado del servidor")
    r = pedir(cliente, como, ruta)
    assert r.status_code == 503
    assert r.json() == {"detail": "Base de datos no disponible"}


def test_no_se_puede_escribir(cliente, como):
    assert cliente.post("/api/usuarios", headers=como("admin")).status_code == 405
    assert cliente.delete("/api/usuarios/U000001", headers=como("admin")).status_code == 405


# --- Con la base real (solo lectura) -------------------------------------------------


@pytest.mark.nube
def test_padron_real_respeta_el_consentimiento():
    """Recorre todo el padrón real. Solo hace GET: no escribe nada en TiDB."""
    app = create_app()
    cabecera = {"Authorization": f"Bearer {app.state.tokens.crear(1, 'analista')}"}
    vistos, sin_consentimiento = [], []
    with TestClient(app) as cliente:
        pagina, total = 1, None
        while True:
            r = cliente.get("/api/usuarios", headers=cabecera, params={"pagina": pagina, "limite": 200})
            assert r.status_code == 200
            cuerpo = r.json()
            total = cuerpo["total"]
            if not cuerpo["datos"]:
                break
            for u in cuerpo["datos"]:
                assert set(u) == LLAVES_USUARIO
                if u["consentimiento_datos"]:
                    assert u["ubicacion"] is not None and set(u["ubicacion"]) == LLAVES_UBICACION
                else:
                    assert u["ubicacion"] is None
                    sin_consentimiento.append(u["id_usuario"])
                vistos.append(u["id_usuario"])
            assert not any(p in r.text for p in ("latitud", "longitud"))
            pagina += 1

        assert len(vistos) == total == len(set(vistos))
        assert vistos == sorted(vistos)
        assert sin_consentimiento, "se esperaban usuarios sin consentimiento en los datos reales"

        # El detalle de un usuario sin consentimiento tampoco trae ubicación
        r = cliente.get(f"/api/usuarios/{sin_consentimiento[0]}", headers=cabecera)
        assert r.status_code == 200 and r.json()["ubicacion"] is None

        # Los filtros por estatus reparten a todo el padrón
        por_estatus = 0
        for estatus in ("activo", "en_riesgo", "inactivo"):
            r = cliente.get("/api/usuarios", headers=cabecera, params={"estatus": estatus, "limite": 1})
            assert r.status_code == 200, (estatus, r.status_code)
            por_estatus += r.json()["total"]
        assert por_estatus == total
