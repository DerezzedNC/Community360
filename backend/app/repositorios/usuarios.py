"""Consultas al padrón de usuarios de TiDB. Solo lectura.

Privacidad (contrato v0.6):
- La ubicación se une solo si consentimiento_datos = TRUE, dentro del propio JOIN: una fila
  sobrante en ubicacion_usuario de alguien sin consentimiento nunca se lee.
- latitud y longitud no se piden nunca.
"""
from pymysql.connections import Connection

COLUMNAS = (
    "id_usuario", "alias", "fecha_ingreso",
    "cod_rango_edad", "cod_especie", "cod_interes", "cod_plataforma",
    "es_artista", "mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas",
    "sentimiento_promedio", "ultima_actividad", "estatus", "consentimiento_datos", "es_atipico",
)

# filtro de la API -> columna de usuario. Nombres fijos: el valor del cliente va como parámetro.
FILTROS = {
    "estatus": "estatus",
    "plataforma": "cod_plataforma",
    "especie": "cod_especie",
    "interes": "cod_interes",
}

SELECT_USUARIO = (
    "SELECT " + ", ".join(f"u.{c}" for c in COLUMNAS) + ", "
    "p.nombre AS pais, e.nombre AS estado, c.nombre AS ciudad, c.zona_horaria "
    "FROM usuario u "
    "LEFT JOIN ubicacion_usuario uu "
    "ON uu.id_usuario = u.id_usuario AND u.consentimiento_datos = TRUE "
    "LEFT JOIN ciudad c ON c.id_ciudad = uu.id_ciudad "
    "LEFT JOIN estado e ON e.id_estado = c.id_estado "
    "LEFT JOIN pais p ON p.id_pais = e.id_pais"
)


def _where(filtros: dict[str, str | None]) -> tuple[str, list]:
    condiciones, parametros = [], []
    for nombre, columna in FILTROS.items():
        valor = filtros.get(nombre)
        if valor is not None:
            condiciones.append(f"u.{columna} = %s")
            parametros.append(valor)
    if not condiciones:
        return "", parametros
    return " WHERE " + " AND ".join(condiciones), parametros


def listar(
    con: Connection, filtros: dict[str, str | None], pagina: int, limite: int
) -> tuple[int, list[dict]]:
    """(total que cumple los filtros, filas de la página pedida)."""
    where, parametros = _where(filtros)
    with con.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM usuario u" + where, parametros)
        total = cur.fetchone()["total"]
        desde = (pagina - 1) * limite
        if desde >= total:
            # Página después de la última: no se manda a TiDB un OFFSET enorme
            return total, []
        cur.execute(
            SELECT_USUARIO + where + " ORDER BY u.id_usuario LIMIT %s OFFSET %s",
            [*parametros, limite, desde],
        )
        return total, cur.fetchall()


def buscar(con: Connection, id_usuario: str) -> dict | None:
    with con.cursor() as cur:
        cur.execute(SELECT_USUARIO + " WHERE u.id_usuario = %s", [id_usuario])
        return cur.fetchone()
