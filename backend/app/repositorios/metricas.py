"""Consultas de /api/metricas/*. Solo lectura. Definiciones en docs/INDICADORES.md."""
from pymysql.connections import Connection

from app.db.capella import Capella

ESTATUS = ("activo", "en_riesgo", "inactivo")
MINIMO_POR_GRUPO = 3  # geografía: grupos más chicos se ocultan

# --- TiDB ----------------------------------------------------------------------------


def _filas(con: Connection, sql: str) -> list[dict]:
    with con.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def resumen_tidb(con: Connection) -> dict:
    [fila] = _filas(
        con,
        "SELECT COUNT(*) AS usuarios, "
        "COALESCE(SUM(estatus = 'activo'), 0) AS usuarios_activos, "
        "COALESCE(SUM(consentimiento_datos = TRUE), 0) AS usuarios_con_consentimiento "
        "FROM usuario",
    )
    return {k: int(v) for k, v in fila.items()}


def usuarios_por_estatus(con: Connection) -> dict[str, int]:
    filas = _filas(con, "SELECT estatus, COUNT(*) AS usuarios FROM usuario GROUP BY estatus")
    return {f["estatus"]: int(f["usuarios"]) for f in filas}


def usuarios_por_plataforma(con: Connection) -> dict[str, int]:
    """Todas las plataformas del catálogo, también las que tienen 0 usuarios."""
    filas = _filas(
        con,
        "SELECT p.codigo, COUNT(u.id_usuario) AS usuarios FROM plataforma p "
        "LEFT JOIN usuario u ON u.cod_plataforma = p.codigo GROUP BY p.codigo",
    )
    return {f["codigo"]: int(f["usuarios"]) for f in filas}


def codigos_de_tema(con: Connection) -> list[str]:
    return [f["codigo"] for f in _filas(con, "SELECT codigo FROM tema")]


# Privacidad: solo usuarios con consentimiento (condición dentro del JOIN); sin coordenadas
# ni id_usuario. Los grupos chicos se quitan después, en ocultar_grupos_chicos.
SQL_GEOGRAFIA = (
    "SELECT p.nombre AS pais, e.nombre AS estado, c.nombre AS ciudad, COUNT(*) AS usuarios "
    "FROM usuario u "
    "JOIN ubicacion_usuario uu ON uu.id_usuario = u.id_usuario AND u.consentimiento_datos = TRUE "
    "JOIN ciudad c ON c.id_ciudad = uu.id_ciudad "
    "JOIN estado e ON e.id_estado = c.id_estado "
    "JOIN pais p ON p.id_pais = e.id_pais "
    "GROUP BY p.nombre, e.nombre, c.nombre"
)


def usuarios_por_ciudad(con: Connection) -> list[dict]:
    return [{**f, "usuarios": int(f["usuarios"])} for f in _filas(con, SQL_GEOGRAFIA)]


# --- Capella -------------------------------------------------------------------------


def resumen_capella(capella: Capella) -> dict:
    [fila] = capella.consultar(
        "SELECT COUNT(*) AS interacciones, COUNT(DISTINCT i.id_usuario) AS usuarios_que_interactuan, "
        "AVG(i.sentimiento) AS sentimiento_promedio FROM interacciones AS i"
    )
    [en_cuarentena] = capella.consultar("SELECT RAW COUNT(*) FROM cuarentena")
    return {**fila, "en_cuarentena": en_cuarentena}


def interacciones_por_canal(capella: Capella) -> dict[str, int]:
    filas = capella.consultar(
        "SELECT i.canal, COUNT(*) AS interacciones FROM interacciones AS i GROUP BY i.canal"
    )
    return {f["canal"]: f["interacciones"] for f in filas}


def interacciones_por_tema(capella: Capella) -> dict[str, dict]:
    filas = capella.consultar(
        "SELECT i.tema, COUNT(*) AS interacciones, AVG(i.sentimiento) AS sentimiento_promedio "
        "FROM interacciones AS i GROUP BY i.tema"
    )
    return {f["tema"]: f for f in filas}


def marcas_de_tiempo(capella: Capella) -> list[str]:
    """Solo el timestamp de cada interacción; el mapa de calor se arma en Python."""
    return capella.consultar("SELECT RAW i.`timestamp` FROM interacciones AS i")
