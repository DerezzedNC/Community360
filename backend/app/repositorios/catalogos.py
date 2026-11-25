"""Consultas a los 8 catálogos de TiDB. Solo lectura."""
from pymysql.connections import Connection

# tabla -> columna con el nombre legible. Son nombres fijos, nunca vienen del cliente.
# Sin geografía (pais, estado, ciudad): ver el contrato v0.5.
CATALOGOS = {
    "rango_edad": "descripcion",
    "especie": "nombre",
    "interes": "nombre",
    "plataforma": "nombre",
    "tema": "nombre",
    "etiqueta": "nombre",
    "tipo_interaccion": "nombre",
    "dispositivo": "nombre",
}
# Columnas que solo tiene un catálogo
EXTRAS = {"tipo_interaccion": "admite_texto"}


def _consulta() -> str:
    """Una sola consulta para los 8: un viaje a TiDB en lugar de ocho."""
    partes = []
    for tabla, columna in CATALOGOS.items():
        extra = EXTRAS.get(tabla, "NULL")
        partes.append(
            f"SELECT '{tabla}' AS catalogo, codigo, {columna} AS nombre, "
            f"{extra} AS extra, activo FROM {tabla}"
        )
    return " UNION ALL ".join(partes) + " ORDER BY catalogo, codigo"


CONSULTA = _consulta()


def listar(con: Connection) -> dict[str, list[dict]]:
    """Los 8 catálogos, con los inactivos incluidos y cada lista ordenada por código."""
    resultado: dict[str, list[dict]] = {tabla: [] for tabla in CATALOGOS}
    with con.cursor() as cur:
        cur.execute(CONSULTA)
        filas = cur.fetchall()
    for fila in filas:
        tabla = fila["catalogo"]
        item = {"codigo": fila["codigo"], CATALOGOS[tabla]: fila["nombre"]}
        if tabla in EXTRAS:
            item[EXTRAS[tabla]] = fila["extra"]
        item["activo"] = fila["activo"]
        resultado[tabla].append(item)
    return resultado
