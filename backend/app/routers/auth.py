"""Inicio de sesión, usuario actual y cierre de sesión."""
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import AfterValidator, BaseModel, Field, SecretStr

from app.dependencias import COOKIE, SesionActual, error_sesion
from app.repositorios import usuario_admin
from app.seguridad import (
    HASH_FICTICIO,
    LARGO_MAXIMO_PASSWORD,
    normalizar_correo,
    verificar_password,
)

router = APIRouter(prefix="/api/auth", tags=["autenticación"])


class DatosLogin(BaseModel):
    correo: Annotated[str, Field(max_length=254), AfterValidator(normalizar_correo)]
    # SecretStr: la contraseña no sale si alguien imprime el objeto
    password: SecretStr = Field(min_length=1, max_length=LARGO_MAXIMO_PASSWORD)


class Usuario(BaseModel):
    id_admin: int
    nombre: str
    correo: str
    rol: Literal["admin", "analista"]


class RespuestaLogin(BaseModel):
    token: str
    tipo: Literal["bearer"] = "bearer"
    expira_en: int
    usuario: Usuario


@router.post("/login")
def login(datos: DatosLogin, request: Request, response: Response) -> RespuestaLogin:
    tokens = request.app.state.tokens
    with request.app.state.tidb.conexion() as con:
        cuenta = usuario_admin.buscar_por_correo(con, datos.correo)
        # Si el correo no existe también se verifica un hash, para que el tiempo no lo revele
        coincide = verificar_password(
            datos.password.get_secret_value(),
            cuenta["password_hash"] if cuenta else HASH_FICTICIO,
        )
        if not cuenta or not coincide or not cuenta["activo"]:
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
        usuario_admin.registrar_acceso(con, cuenta["id_admin"])

    token = tokens.crear(cuenta["id_admin"], cuenta["rol"])
    # Sin Secure porque el proyecto corre en http://localhost
    response.set_cookie(
        COOKIE, token, max_age=tokens.segundos, path="/", httponly=True, samesite="lax"
    )
    response.headers["Cache-Control"] = "no-store"
    return RespuestaLogin(
        token=token, expira_en=tokens.segundos, usuario=Usuario.model_validate(cuenta)
    )


@router.get("/me")
def me(request: Request, sesion: SesionActual) -> Usuario:
    with request.app.state.tidb.conexion() as con:
        cuenta = usuario_admin.buscar_por_id(con, sesion.id_admin)
    if not cuenta or not cuenta["activo"]:
        raise error_sesion()
    return Usuario.model_validate(cuenta)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, sesion: SesionActual) -> None:
    request.app.state.tokens.revocar(sesion)
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax")
