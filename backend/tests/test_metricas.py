"""/api/metricas/* (contrato v0.8, docs/INDICADORES.md). Sin red: TiDB y Capella falsas."""
import re
from contextlib import contextmanager

import pymysql
import pytest
from fastapi.testclient import TestClient

from app.db.capella import CapellaNoDisponible
from app.main import create_app
from app.repositorios import metricas
from tests.conftest import BaseFalsa

RUTAS = ["resumen", "estatus", "plataformas", "temas", "actividad", "geografia", "puntos-calientes",
         "tipos", "etiquetas", "demografia"]

# fragmento de la consulta -> filas que devuelve
TIDB = {
    "COUNT(*) AS usuarios, ": [{"usuarios": 10, "usuarios_activos": 4, "usuarios_con_consentimiento": 7}],
    "GROUP BY estatus": [{"estatus": "activo", "usuarios": 4}, {"estatus": "inactivo", "usuarios": 6}],
    "FROM plataforma p": [{"codigo": "discord", "usuarios": 6}, {"codigo": "tiktok", "usuarios": 0}],
    "SELECT codigo FROM tema": [{"codigo": "musica"}, {"codigo": "memes_humor"}],
    "FROM rango_edad": [{"codigo": "18_24", "descripcion": "18-24"}, {"codigo": "25_31", "descripcion": "25-31"}],
    "FROM interes": [{"codigo": "arte_digital", "nombre": "Arte digital"}, {"codigo": "musica", "nombre": "Música"}],
    "GROUP BY cod_rango_edad, cod_interes": [
        {"cod_rango_edad": "25_31", "cod_interes": "arte_digital", "usuarios": 3},
        {"cod_rango_edad": "18_24", "cod_interes": "arte_digital", "usuarios": 4},
        {"cod_rango_edad": "18_24", "cod_interes": "musica", "usuarios": 1},
    ],
    "FROM tipo_interaccion": [{"codigo": "comentario", "nombre": "Comentario"},
                              {"codigo": "reaccion", "nombre": "Reacción"}],
    "FROM etiqueta": [{"codigo": f"e{n:02}", "nombre": f"Etiqueta {n}"} for n in range(12)],
    "c.nombre AS ciudad": [
        {"pais": "México", "estado": "Yucatán", "ciudad": "Mérida", "usuarios": 5},
        {"pais": "México", "estado": "Yucatán", "ciudad": "Valladolid", "usuarios": 2},  # se oculta
        {"pais": "Chile", "estado": "Santiago", "ciudad": "Santiago", "usuarios": 1},    # se oculta
    ],
    "AS cuadro_lat": [
        {"cuadro_lat": 104, "cuadro_lon": -449, "usuarios": 9},  # Mérida: 20.8 a 21.0, -89.8 a -89.6
        {"cuadro_lat": 97, "cuadro_lon": -497, "usuarios": 3},
        {"cuadro_lat": 98, "cuadro_lon": -497, "usuarios": 2},   # se oculta
        {"cuadro_lat": 0, "cuadro_lon": 0, "usuarios": 1},       # se oculta
    ],
}
CAPELLA = {
    "AS usuarios_que_interactuan": [{"interacciones": 3, "usuarios_que_interactuan": 2,
                                     "sentimiento_promedio": 0.33333}],
    "FROM cuarentena": [5],
    "GROUP BY i.canal": [{"canal": "discord", "interacciones": 3}],
    "GROUP BY i.tema": [{"tema": "musica", "interacciones": 3, "sentimiento_promedio": 0.5}],
    "GROUP BY i.tipo": [{"tipo": "comentario", "interacciones": 3}, {"tipo": "viejo", "interacciones": 1}],
    # 12 etiquetas usadas: e00 la más usada ... e11 la menos; e05 y e06 empatan
    "UNNEST i.etiquetas": [{"etiqueta": f"e{n:02}", "interacciones": 20 - n} for n in range(12) if n != 6]
                          + [{"etiqueta": "e06", "interacciones": 15}, {"etiqueta": "rara", "interacciones": 0}],
    "RAW i.`timestamp`": ["2026-11-23T10:15:00Z", "2026-11-23T10:59:59Z", "2026-11-29T23:00:00Z", None],
}


class Guion(BaseFalsa):
    """Responde según un fragmento de la consulta. Sirve como TiDB y como Capella."""

    def __init__(self, respuestas):
        super().__init__()
        self.respuestas = respuestas
        self.consultas = []
        self.falla = None
        self._filas = None

    def _buscar(self, sql):
        if self.falla:
            raise self.falla
        self.consultas.append(sql)
        [filas] = [f for clave, f in self.respuestas.items() if clave in sql]
        return filas

    # TiDB
    @contextmanager
    def conexion(self):
        if self.falla:
            raise self.falla
        yield self

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros=None):
        self._filas = self._buscar(sql)

    def fetchall(self):
        return self._filas

    # Capella
    def consultar(self, sql, **parametros):
        return list(self._buscar(sql))


@pytest.fixture
def tidb():
    return Guion(TIDB)


@pytest.fixture
def capella():
    return Guion(CAPELLA)


@pytest.fixture
def cliente(settings_prueba, tidb, capella):
    app = create_app(settings_prueba, tidb, capella)
    cliente = TestClient(app, raise_server_exceptions=False)
    cliente.headers["Authorization"] = f"Bearer {app.state.tokens.crear(1, 'analista')}"
    return cliente


def pedir(cliente, ruta):
    r = cliente.get(f"/api/metricas/{ruta}")
    assert r.status_code == 200, (ruta, r.status_code, r.text)
    return r.json()


def test_resumen(cliente):
    r = pedir(cliente, "resumen")
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", r.pop("generado_en"))
    assert r == {
        "usuarios": 10, "usuarios_activos": 4, "porcentaje_activos": 40.0,
        "usuarios_con_consentimiento": 7, "interacciones": 3, "usuarios_que_interactuan": 2,
        "sentimiento_promedio": 0.333, "en_cuarentena": 5,
    }


def test_estatus_siempre_los_tres(cliente):
    assert pedir(cliente, "estatus") == {"total": 10, "datos": [
        {"estatus": "activo", "usuarios": 4, "porcentaje": 40.0},
        {"estatus": "en_riesgo", "usuarios": 0, "porcentaje": 0.0},
        {"estatus": "inactivo", "usuarios": 6, "porcentaje": 60.0},
    ]}


def test_plataformas_y_temas_incluyen_los_ceros(cliente):
    assert pedir(cliente, "plataformas")["datos"] == [
        {"plataforma": "discord", "usuarios": 6, "interacciones": 3},
        {"plataforma": "tiktok", "usuarios": 0, "interacciones": 0},
    ]
    assert pedir(cliente, "temas")["datos"] == [
        {"tema": "memes_humor", "interacciones": 0, "sentimiento_promedio": None},
        {"tema": "musica", "interacciones": 3, "sentimiento_promedio": 0.5},
    ]


def test_tipos_con_nombre_del_catalogo_e_incluye_ceros(cliente):
    assert pedir(cliente, "tipos") == {"total": 4, "datos": [
        {"tipo": "comentario", "nombre": "Comentario", "interacciones": 3, "porcentaje": 75.0},
        {"tipo": "reaccion", "nombre": "Reacción", "interacciones": 0, "porcentaje": 0.0},
        {"tipo": "viejo", "nombre": None, "interacciones": 1, "porcentaje": 25.0},  # no está en el catálogo
    ]}


def test_etiquetas_top_10_de_mas_a_menos(cliente):
    r = pedir(cliente, "etiquetas")
    assert r["limite"] == 10 and len(r["datos"]) == 10
    assert [e["etiqueta"] for e in r["datos"]] == ["e00", "e01", "e02", "e03", "e04", "e05", "e06",
                                                  "e07", "e08", "e09"]
    assert r["datos"][0] == {"etiqueta": "e00", "nombre": "Etiqueta 0", "interacciones": 20}
    assert r["datos"][5]["interacciones"] == r["datos"][6]["interacciones"] == 15  # empate: por código


def test_demografia_por_edad_interes_y_cruce(cliente):
    assert pedir(cliente, "demografia") == {
        "total": 8,
        "rangos_edad": [
            {"rango_edad": "18_24", "descripcion": "18-24", "usuarios": 5, "porcentaje": 62.5},
            {"rango_edad": "25_31", "descripcion": "25-31", "usuarios": 3, "porcentaje": 37.5},
        ],
        "intereses": [
            {"interes": "arte_digital", "nombre": "Arte digital", "usuarios": 7, "porcentaje": 87.5},
            {"interes": "musica", "nombre": "Música", "usuarios": 1, "porcentaje": 12.5},
        ],
        "cruce": [
            {"rango_edad": "18_24", "interes": "arte_digital", "usuarios": 4},
            {"rango_edad": "18_24", "interes": "musica", "usuarios": 1},
            {"rango_edad": "25_31", "interes": "arte_digital", "usuarios": 3},
        ],
    }


def test_actividad_168_celdas_en_utc(cliente):
    r = pedir(cliente, "actividad")
    assert r["zona_horaria"] == "UTC" and len(r["datos"]) == 168
    celdas = {(c["dia_semana"], c["hora"]): c["interacciones"] for c in r["datos"]}
    assert celdas[(1, 10)] == 2  # 2026-11-23 es lunes
    assert celdas[(7, 23)] == 1  # 2026-11-29 es domingo
    assert sum(celdas.values()) == 3  # el None no cuenta


def test_geografia_oculta_grupos_de_menos_de_3(cliente):
    assert pedir(cliente, "geografia") == {
        "minimo_por_grupo": 3,
        "usuarios_con_ubicacion": 8,
        "estados": [{"pais": "México", "estado": "Yucatán", "usuarios": 7}],
        "ciudades": [{"pais": "México", "estado": "Yucatán", "ciudad": "Mérida", "usuarios": 5}],
    }


def test_geografia_solo_con_consentimiento_y_sin_coordenadas():
    sql = metricas.SQL_GEOGRAFIA
    assert "JOIN ubicacion_usuario uu ON uu.id_usuario = u.id_usuario AND u.consentimiento_datos = TRUE" in sql
    assert not re.search(r"\b(latitud|longitud)\b", sql)
    assert "u.id_usuario AS" not in sql and "SELECT u." not in sql


@pytest.mark.parametrize("ruta", RUTAS)
def test_sin_sesion_401(cliente, ruta):
    del cliente.headers["Authorization"]
    assert cliente.get(f"/api/metricas/{ruta}").status_code == 401


def en_cuadricula(valor: float) -> bool:
    """El centro de un cuadro de 0.2° siempre es k×0.2 + 0.1: en décimas, un número impar."""
    decimas = valor * 10
    return abs(decimas - round(decimas)) < 1e-9 and round(decimas) % 2 != 0


def test_puntos_calientes_solo_centros_y_cuadros_de_3_o_mas(cliente):
    r = pedir(cliente, "puntos-calientes")
    assert r == {
        "tamano_cuadro": 0.2, "minimo_por_cuadro": 3,
        "usuarios_con_coordenadas": 15, "usuarios_en_mapa": 12,
        "datos": [
            {"latitud_centro": 20.9, "longitud_centro": -89.7, "usuarios": 9},
            {"latitud_centro": 19.5, "longitud_centro": -99.3, "usuarios": 3},
        ],
    }
    assert all(c["usuarios"] >= 3 for c in r["datos"])
    assert all(en_cuadricula(c["latitud_centro"]) and en_cuadricula(c["longitud_centro"]) for c in r["datos"])


def test_puntos_calientes_agrupa_en_tidb_solo_con_consentimiento():
    sql = metricas.SQL_PUNTOS_CALIENTES
    assert "JOIN ubicacion_usuario uu ON uu.id_usuario = u.id_usuario AND u.consentimiento_datos = TRUE" in sql
    assert "GROUP BY cuadro_lat, cuadro_lon" in sql
    # En lo que se devuelve, las coordenadas solo aparecen dentro de FLOOR(): nunca tal cual
    columnas = sql.split(" FROM ")[0]
    sin_floor = re.sub(r"FLOOR\(uu\.(latitud|longitud) / 0\.2\)", "", columnas)
    assert not re.search(r"\b(latitud|longitud|id_usuario)\b", sin_floor)


@pytest.mark.parametrize("ruta", ["resumen", "estatus", "plataformas", "temas", "geografia", "puntos-calientes",
                                  "tipos", "etiquetas", "demografia"])
def test_tidb_caida_503(cliente, tidb, ruta):
    tidb.falla = pymysql.err.OperationalError(2003, "detalle privado")
    r = cliente.get(f"/api/metricas/{ruta}")
    assert (r.status_code, r.json()) == (503, {"detail": "Base de datos no disponible"})


@pytest.mark.parametrize("ruta", ["resumen", "plataformas", "temas", "actividad", "tipos", "etiquetas"])
def test_capella_caida_503(cliente, capella, ruta):
    capella.falla = CapellaNoDisponible("sin conexión")
    r = cliente.get(f"/api/metricas/{ruta}")
    assert (r.status_code, r.json()) == (503, {"detail": "Base de datos no disponible"})


@pytest.mark.nube
def test_metricas_con_bases_reales():
    """Solo lectura. Necesita TiDB y Capella (con WARP apagado)."""
    app = create_app()
    cabecera = {"Authorization": f"Bearer {app.state.tokens.crear(1, 'analista')}"}
    with TestClient(app) as cliente:
        r = {ruta: cliente.get(f"/api/metricas/{ruta}", headers=cabecera) for ruta in RUTAS}
    assert {ruta: x.status_code for ruta, x in r.items()} == {ruta: 200 for ruta in RUTAS}
    resumen = r["resumen"].json()
    assert resumen["usuarios"] == r["estatus"].json()["total"]
    demo = r["demografia"].json()
    assert resumen["usuarios"] == demo["total"] == sum(f["usuarios"] for f in demo["cruce"])
    assert all(f["descripcion"] for f in demo["rangos_edad"]) and all(f["nombre"] for f in demo["intereses"])
    assert resumen["interacciones"] == sum(c["interacciones"] for c in r["actividad"].json()["datos"])
    assert resumen["interacciones"] == sum(t["interacciones"] for t in r["temas"].json()["datos"])
    assert resumen["interacciones"] == r["tipos"].json()["total"]
    assert all(t["nombre"] for t in r["tipos"].json()["datos"])
    etiquetas = r["etiquetas"].json()["datos"]
    assert 0 < len(etiquetas) <= 10 and all(e["nombre"] and e["interacciones"] > 0 for e in etiquetas)
    assert [e["interacciones"] for e in etiquetas] == sorted((e["interacciones"] for e in etiquetas), reverse=True)
    geo = r["geografia"].json()
    assert all(g["usuarios"] >= 3 for g in geo["estados"] + geo["ciudades"])
    assert "latitud" not in r["geografia"].text and "longitud" not in r["geografia"].text
    mapa = r["puntos-calientes"].json()
    assert mapa["datos"] and all(c["usuarios"] >= 3 for c in mapa["datos"])
    assert all(en_cuadricula(c["latitud_centro"]) and en_cuadricula(c["longitud_centro"]) for c in mapa["datos"])
    assert set(mapa["datos"][0]) == {"latitud_centro", "longitud_centro", "usuarios"}
    assert mapa["usuarios_en_mapa"] == sum(c["usuarios"] for c in mapa["datos"])
