"""Registros rechazados por el ETL, en Capella (contrato v0.9). Solo lectura.

Privacidad: aunque el ETL ya quitó la geografía, la API la vuelve a quitar de `registro`.
"""
from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.paginacion import Limite, Pagina

router = APIRouter(prefix="/api", tags=["cuarentena"])

MOTIVOS = Literal[
    "duplicado", "tipo_dato_invalido", "categoria_invalida",
    "usuario_inexistente", "fecha_anterior_ingreso",
]
CAMPOS_GEOGRAFICOS = {"pais", "estado", "ciudad", "zona_horaria", "latitud", "longitud"}

CAMPOS = (
    "META(q).id AS id_cuarentena, q.id_original, q.registro, q.motivos, q.fuente, "
    "q.id_lote, q.detectado_en, q.estado_revision"
)
FILTRO_MOTIVO = " WHERE ANY m IN q.motivos SATISFIES m = $motivo END"


class Rechazado(BaseModel):
    id_cuarentena: str
    tipo_registro: str
    motivos: list[str]
    detectado_en: str | None
    fuente: str | None
    id_lote: str | None
    estado_revision: str | None
    id_original: str | None
    registro: dict[str, Any]


class ListaCuarentena(BaseModel):
    total: int
    pagina: int
    limite: int
    datos: list[Rechazado]


def a_rechazado(doc: dict) -> Rechazado:
    registro = {k: v for k, v in (doc.get("registro") or {}).items() if k not in CAMPOS_GEOGRAFICOS}
    return Rechazado(
        id_cuarentena=doc["id_cuarentena"],
        # El ETL solo manda interacciones a cuarentena; se deduce del registro original
        tipo_registro="interaccion" if "id_interaccion" in registro else "otro",
        motivos=doc.get("motivos") or [],
        detectado_en=doc.get("detectado_en"),
        fuente=doc.get("fuente"),
        id_lote=doc.get("id_lote"),
        estado_revision=doc.get("estado_revision"),
        id_original=doc.get("id_original"),
        registro=registro,
    )


@router.get("/cuarentena")
def listar_cuarentena(
    request: Request, pagina: Pagina = 1, limite: Limite = 50, motivo: MOTIVOS | None = None
) -> ListaCuarentena:
    capella = request.app.state.capella
    where = FILTRO_MOTIVO if motivo else ""
    filtro = {"motivo": motivo} if motivo else {}
    [total] = capella.consultar("SELECT RAW COUNT(*) FROM cuarentena AS q" + where, **filtro)
    desde = (pagina - 1) * limite
    docs = []
    if desde < total:
        docs = capella.consultar(
            f"SELECT {CAMPOS} FROM cuarentena AS q{where} "
            "ORDER BY q.detectado_en DESC, META(q).id LIMIT $limite OFFSET $desde",
            **filtro, limite=limite, desde=desde,
        )
    return ListaCuarentena(total=total, pagina=pagina, limite=limite, datos=[a_rechazado(d) for d in docs])
