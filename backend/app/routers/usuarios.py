"""Padrón de usuarios (contrato v0.6). Solo lectura."""
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request
from pydantic import BaseModel

from app.repositorios import usuarios

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])

LIMITE_MAXIMO = 200
FORMATO_CODIGO = r"^[a-z0-9_]+$"
FORMATO_ID = r"^U[0-9]{6,9}$"

Codigo = Annotated[str | None, Query(pattern=FORMATO_CODIGO, max_length=30)]


class Ubicacion(BaseModel):
    # Hasta ciudad: la API nunca devuelve latitud ni longitud
    pais: str
    estado: str
    ciudad: str
    zona_horaria: str


class Usuario(BaseModel):
    id_usuario: str
    alias: str
    fecha_ingreso: date
    cod_rango_edad: str
    cod_especie: str
    cod_interes: str
    cod_plataforma: str
    es_artista: bool
    mensajes_30d: int
    reacciones_30d: int
    eventos_asistidos: int
    comisiones_compradas: int
    sentimiento_promedio: float | None
    ultima_actividad: date
    estatus: str
    consentimiento_datos: bool
    es_atipico: bool
    ubicacion: Ubicacion | None


class ListaUsuarios(BaseModel):
    total: int
    pagina: int
    limite: int
    datos: list[Usuario]


def a_usuario(fila: dict) -> Usuario:
    """Arma la respuesta. Segunda capa de privacidad: sin consentimiento no hay ubicación,
    traiga lo que traiga la fila."""
    datos = {c: fila[c] for c in usuarios.COLUMNAS}
    if datos["consentimiento_datos"] and fila.get("pais") is not None:
        datos["ubicacion"] = Ubicacion(
            pais=fila["pais"], estado=fila["estado"],
            ciudad=fila["ciudad"], zona_horaria=fila["zona_horaria"],
        )
    else:
        datos["ubicacion"] = None
    return Usuario.model_validate(datos)


@router.get("")
def listar_usuarios(
    request: Request,
    pagina: Annotated[int, Query(ge=1)] = 1,
    limite: Annotated[int, Query(ge=1, le=LIMITE_MAXIMO)] = 50,
    estatus: Literal["activo", "en_riesgo", "inactivo"] | None = None,
    plataforma: Codigo = None,
    especie: Codigo = None,
    interes: Codigo = None,
) -> ListaUsuarios:
    filtros = {"estatus": estatus, "plataforma": plataforma, "especie": especie, "interes": interes}
    with request.app.state.tidb.conexion() as con:
        total, filas = usuarios.listar(con, filtros, pagina, limite)
    return ListaUsuarios(
        total=total, pagina=pagina, limite=limite, datos=[a_usuario(f) for f in filas]
    )


@router.get("/{id_usuario}")
def obtener_usuario(
    request: Request, id_usuario: Annotated[str, Path(pattern=FORMATO_ID)]
) -> Usuario:
    with request.app.state.tidb.conexion() as con:
        fila = usuarios.buscar(con, id_usuario)
    if not fila:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return a_usuario(fila)
