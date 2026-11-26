"""CRUD de interacciones en Capella (contrato v0.10). Escribe solo admin (ver dependencias.py).

Cada alta o cambio se valida contra TiDB: el usuario existe, la fecha no es anterior a su
ingreso y los códigos existen y están activos en sus catálogos. No se acepta ningún campo
que no esté en el contrato, así que tampoco campos de ubicación.
"""
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.dependencias import SesionActual
from app.paginacion import Limite, Pagina
from app.repositorios import catalogos
from app.repositorios import interacciones as repo

router = APIRouter(prefix="/api/interacciones", tags=["interacciones"])

FORMATO_ID = r"^I[0-9]{7}$"
FORMATO_USUARIO = r"^U[0-9]{6,9}$"
FORMATO_FECHA = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
FORMATO_CODIGO = r"^[a-z0-9_]+$"
INTENTOS_ID = 3

CodigoCampo = Annotated[str, Field(pattern=FORMATO_CODIGO, max_length=30)]
CodigoFiltro = Annotated[str | None, Query(pattern=FORMATO_CODIGO, max_length=30)]
IdRuta = Annotated[str, Path(pattern=FORMATO_ID)]

# campo -> catálogo de TiDB contra el que se valida
CATALOGO_DE = {"canal": "plataforma", "tipo": "tipo_interaccion", "tema": "tema", "dispositivo": "dispositivo"}


class DatosInteraccion(BaseModel):
    """Lo que manda el cliente en POST y PUT."""

    model_config = ConfigDict(extra="forbid")  # pais, latitud, longitud_texto... → 422

    id_usuario: str = Field(pattern=FORMATO_USUARIO)
    timestamp: str = Field(pattern=FORMATO_FECHA)
    canal: CodigoCampo
    tipo: CodigoCampo
    tema: CodigoCampo
    dispositivo: CodigoCampo
    texto: str | None = Field(default=None, min_length=1, max_length=2000)
    sentimiento: float = Field(ge=-1, le=1)
    idioma: Literal["es", "en", "pt"]
    reacciones_recibidas: int = Field(ge=0)
    etiquetas: list[CodigoCampo] = Field(default_factory=list, max_length=10)


class NuevaInteraccion(DatosInteraccion):
    id_interaccion: str | None = Field(default=None, pattern=FORMATO_ID)


class Interaccion(BaseModel):
    id_interaccion: str
    id_usuario: str
    timestamp: str
    canal: str
    tipo: str
    tema: str
    texto: str | None = None
    longitud_texto: int | None = None
    sentimiento: float
    idioma: str
    dispositivo: str
    reacciones_recibidas: int
    etiquetas: list[str] = []


class ListaInteracciones(BaseModel):
    total: int
    pagina: int
    limite: int
    datos: list[Interaccion]


def ahora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def error_datos(errores: list[tuple[str, str]]) -> HTTPException:
    """422 con el mismo formato que los errores de FastAPI (type, loc, msg)."""
    detalle = [{"type": "valor_invalido", "loc": ["body", campo], "msg": msg} for campo, msg in errores]
    return HTTPException(status_code=422, detail=detalle)


def validar_contra_tidb(tidb, datos: DatosInteraccion) -> None:
    errores = []
    try:
        momento = datetime.strptime(datos.timestamp, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        raise error_datos([("timestamp", "No es una fecha válida")]) from None
    with tidb.conexion() as con:
        with con.cursor() as cur:
            cur.execute("SELECT fecha_ingreso FROM usuario WHERE id_usuario = %s", (datos.id_usuario,))
            usuario = cur.fetchone()
        tablas = catalogos.listar(con)
    activos = {t: {c["codigo"] for c in filas if c["activo"]} for t, filas in tablas.items()}

    if not usuario:
        errores.append(("id_usuario", "El usuario no existe"))
    elif momento.date() < usuario["fecha_ingreso"]:
        errores.append(("timestamp", "Es anterior a la fecha de ingreso del usuario"))
    for campo, tabla in CATALOGO_DE.items():
        if getattr(datos, campo) not in activos[tabla]:
            errores.append((campo, f"No existe o está inactivo en el catálogo {tabla}"))
    for etiqueta in datos.etiquetas:
        if etiqueta not in activos["etiqueta"]:
            errores.append(("etiquetas", f"La etiqueta {etiqueta} no existe o está inactiva"))

    tipo = next((t for t in tablas["tipo_interaccion"] if t["codigo"] == datos.tipo), None)
    if tipo and not tipo["admite_texto"] and datos.texto is not None:
        errores.append(("texto", f"El tipo {datos.tipo} no admite texto"))
    if tipo and tipo["admite_texto"] and datos.texto is None:
        errores.append(("texto", f"El tipo {datos.tipo} necesita texto"))
    if errores:
        raise error_datos(errores)


def a_documento(datos: DatosInteraccion, metadatos: dict) -> dict:
    doc = datos.model_dump(exclude={"id_interaccion", "texto"})
    if datos.texto is not None:  # como en el ETL: el campo solo existe si hay texto
        doc["texto"] = datos.texto
        doc["longitud_texto"] = len(datos.texto)
    doc["metadatos"] = metadatos
    return doc


def avisar_cambio(request: Request) -> None:
    """Fase 5: el WebSocket manda el resumen actualizado. No frena la respuesta si falla."""
    aviso = getattr(request.app.state, "avisar_cambio", None)
    if aviso:
        aviso()


# --- Lectura (ambos roles) -----------------------------------------------------------


@router.get("")
def listar_interacciones(
    request: Request,
    pagina: Pagina = 1,
    limite: Limite = 50,
    id_usuario: Annotated[str | None, Query(pattern=FORMATO_USUARIO)] = None,
    canal: CodigoFiltro = None,
    tipo: CodigoFiltro = None,
    tema: CodigoFiltro = None,
    desde: Annotated[str | None, Query(pattern=FORMATO_FECHA)] = None,
    hasta: Annotated[str | None, Query(pattern=FORMATO_FECHA)] = None,
) -> ListaInteracciones:
    filtros = {"id_usuario": id_usuario, "canal": canal, "tipo": tipo, "tema": tema,
               "desde": desde, "hasta": hasta}
    total, docs = repo.listar(request.app.state.capella, filtros, pagina, limite)
    return ListaInteracciones(total=total, pagina=pagina, limite=limite,
                              datos=[Interaccion.model_validate(d) for d in docs])


@router.get("/{id_interaccion}")
def obtener_interaccion(request: Request, id_interaccion: IdRuta) -> Interaccion:
    try:
        return Interaccion.model_validate(repo.obtener(request.app.state.capella, id_interaccion))
    except repo.NoEncontrada:
        raise HTTPException(status_code=404, detail="Interacción no encontrada") from None


# --- Escritura (solo admin) ----------------------------------------------------------


@router.post("", status_code=201)
def crear_interaccion(request: Request, datos: NuevaInteraccion, sesion: SesionActual) -> Interaccion:
    capella = request.app.state.capella
    validar_contra_tidb(request.app.state.tidb, datos)
    metadatos = {"origen": "api", "creado_en": ahora_utc(), "creado_por": sesion.id_admin}
    doc = a_documento(datos, metadatos)
    if datos.id_interaccion:
        try:
            repo.crear(capella, datos.id_interaccion, doc)
        except repo.Repetida:
            raise HTTPException(status_code=409, detail="Ya existe una interacción con ese id") from None
        id_interaccion = datos.id_interaccion
    else:
        # Otro admin pudo tomar el mismo id al mismo tiempo: se reintenta con el siguiente
        for _ in range(INTENTOS_ID):
            id_interaccion = repo.siguiente_id(capella)
            try:
                repo.crear(capella, id_interaccion, doc)
                break
            except repo.Repetida:
                continue
        else:
            raise HTTPException(status_code=409, detail="No se pudo asignar un id; intenta de nuevo")
    avisar_cambio(request)
    return Interaccion.model_validate({"id_interaccion": id_interaccion, **doc})


@router.put("/{id_interaccion}")
def editar_interaccion(
    request: Request, id_interaccion: IdRuta, datos: DatosInteraccion, sesion: SesionActual
) -> Interaccion:
    capella = request.app.state.capella
    try:
        anterior = repo.obtener(capella, id_interaccion)
    except repo.NoEncontrada:
        raise HTTPException(status_code=404, detail="Interacción no encontrada") from None
    validar_contra_tidb(request.app.state.tidb, datos)
    # Se conserva de dónde vino (ETL o API) y se anota quién la cambió
    metadatos = {**(anterior.get("metadatos") or {}), "actualizado_en": ahora_utc(),
                 "actualizado_por": sesion.id_admin}
    doc = a_documento(datos, metadatos)
    try:
        repo.reemplazar(capella, id_interaccion, doc)
    except repo.NoEncontrada:  # la borraron entre la lectura y el cambio
        raise HTTPException(status_code=404, detail="Interacción no encontrada") from None
    avisar_cambio(request)
    return Interaccion.model_validate({"id_interaccion": id_interaccion, **doc})


@router.delete("/{id_interaccion}", status_code=204)
def borrar_interaccion(request: Request, id_interaccion: IdRuta) -> Response:
    try:
        repo.borrar(request.app.state.capella, id_interaccion)
    except repo.NoEncontrada:
        raise HTTPException(status_code=404, detail="Interacción no encontrada") from None
    avisar_cambio(request)
    return Response(status_code=204)
