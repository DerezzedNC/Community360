"""Catálogos de TiDB para nombres legibles y opciones de los filtros (contrato v0.5)."""
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.repositorios import catalogos

router = APIRouter(prefix="/api", tags=["catálogos"])


class Codigo(BaseModel):
    codigo: str
    nombre: str
    activo: bool


class RangoEdad(BaseModel):
    # Mismo nombre que la columna de TiDB
    codigo: str
    descripcion: str
    activo: bool


class TipoInteraccion(Codigo):
    admite_texto: bool


class Catalogos(BaseModel):
    rango_edad: list[RangoEdad]
    especie: list[Codigo]
    interes: list[Codigo]
    plataforma: list[Codigo]
    tema: list[Codigo]
    etiqueta: list[Codigo]
    tipo_interaccion: list[TipoInteraccion]
    dispositivo: list[Codigo]


@router.get("/catalogos")
def listar_catalogos(request: Request) -> Catalogos:
    # "def" sin async: FastAPI la corre en otro hilo y la consulta no frena a las demás
    with request.app.state.tidb.conexion() as con:
        return Catalogos.model_validate(catalogos.listar(con))
