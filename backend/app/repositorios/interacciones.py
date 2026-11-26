"""Interacciones en Capella (colección `interacciones`). La llave del documento es el id.

Lecturas con SQL++ (request_plus, ver Capella.consultar); escrituras por llave.
Los documentos nunca guardan ubicación: la interacción la toma del usuario.
"""
from couchbase.exceptions import DocumentExistsException, DocumentNotFoundException

from app.db.capella import Capella

COLECCION = "interacciones"
CAMPOS = (
    "id_usuario", "timestamp", "canal", "tipo", "tema", "texto", "longitud_texto",
    "sentimiento", "idioma", "dispositivo", "reacciones_recibidas", "etiquetas",
)
SELECT = (
    "SELECT META(i).id AS id_interaccion, "
    + ", ".join(f"i.`{c}`" for c in CAMPOS)
    + " FROM interacciones AS i"
)
# filtro de la API -> condición. Los valores van como $parametros
FILTROS = {
    "id_usuario": "i.id_usuario = $id_usuario",
    "canal": "i.canal = $canal",
    "tipo": "i.tipo = $tipo",
    "tema": "i.tema = $tema",
    "desde": "i.`timestamp` >= $desde",
    "hasta": "i.`timestamp` <= $hasta",
}


class Repetida(ValueError):
    """Ya existe una interacción con ese id."""


class NoEncontrada(LookupError):
    """No existe una interacción con ese id."""


def listar(capella: Capella, filtros: dict, pagina: int, limite: int) -> tuple[int, list[dict]]:
    usados = {k: v for k, v in filtros.items() if v is not None}
    where = " WHERE " + " AND ".join(FILTROS[k] for k in usados) if usados else ""
    [total] = capella.consultar("SELECT RAW COUNT(*) FROM interacciones AS i" + where, **usados)
    desde = (pagina - 1) * limite
    if desde >= total:
        return total, []
    docs = capella.consultar(
        SELECT + where + " ORDER BY i.`timestamp` DESC, META(i).id LIMIT $limite OFFSET $salto",
        **usados, limite=limite, salto=desde,
    )
    return total, docs


def obtener(capella: Capella, id_interaccion: str) -> dict:
    try:
        doc = capella.coleccion(COLECCION).get(id_interaccion).content_as[dict]
    except DocumentNotFoundException:
        raise NoEncontrada(id_interaccion) from None
    return {"id_interaccion": id_interaccion, **doc}


def siguiente_id(capella: Capella) -> str:
    """I + 7 dígitos, uno más que el mayor existente."""
    [mayor] = capella.consultar(
        'SELECT RAW MAX(META(i).id) FROM interacciones AS i WHERE META(i).id LIKE "I%"'
    )
    numero = int(mayor[1:]) + 1 if mayor and mayor[1:].isdigit() else 1
    return f"I{numero:07d}"


def crear(capella: Capella, id_interaccion: str, doc: dict) -> None:
    try:
        capella.coleccion(COLECCION).insert(id_interaccion, doc)
    except DocumentExistsException:
        raise Repetida(id_interaccion) from None


def reemplazar(capella: Capella, id_interaccion: str, doc: dict) -> None:
    try:
        capella.coleccion(COLECCION).replace(id_interaccion, doc)
    except DocumentNotFoundException:
        raise NoEncontrada(id_interaccion) from None


def borrar(capella: Capella, id_interaccion: str) -> None:
    """Borrado físico (contrato: DELETE → 204)."""
    try:
        capella.coleccion(COLECCION).remove(id_interaccion)
    except DocumentNotFoundException:
        raise NoEncontrada(id_interaccion) from None
