"""Dependencias comunes: sesión y permisos."""
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.requests import HTTPConnection

from app.repositorios import usuario_admin
from app.tokens import Sesion, TokenInvalido

COOKIE = "c360_token"

# Todo lo que no esté aquí pide sesión
RUTAS_PUBLICAS = {("GET", "/api/health"), ("POST", "/api/auth/login")}
# No son de lectura, pero las puede usar cualquier rol
RUTAS_DE_AMBOS_ROLES = {("POST", "/api/auth/logout")}
METODOS_DE_LECTURA = {"GET", "HEAD"}


def error_sesion() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Sesión no válida o vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )


def error_permiso() -> HTTPException:
    return HTTPException(status_code=403, detail="Tu rol no permite esta operación")


# HTTPConnection es la base común de Request y WebSocket


def leer_token(conexion: HTTPConnection) -> str:
    """El Bearer gana aunque venga vacío; la cookie solo se usa si no hay Bearer."""
    esquema, _, valor = conexion.headers.get("Authorization", "").strip().partition(" ")
    if esquema.lower() == "bearer":
        return valor.strip()
    return conexion.cookies.get(COOKIE, "")


def sesion_actual(conexion: HTTPConnection) -> Sesion:
    try:
        return conexion.app.state.tokens.validar(leer_token(conexion))
    except TokenInvalido:
        raise error_sesion() from None


SesionActual = Annotated[Sesion, Depends(sesion_actual)]


def proteger(conexion: HTTPConnection) -> None:
    """Se aplica a toda la app: sesión en todas las rutas y rol admin para escribir."""
    if conexion.scope["type"] == "websocket":
        return  # /ws revisa su propia sesión: cierra con 4401 en lugar de responder 401
    ruta = (conexion.scope["method"], conexion.scope["path"])
    if ruta in RUTAS_PUBLICAS:
        return
    sesion = sesion_actual(conexion)
    if ruta[0] in METODOS_DE_LECTURA or ruta in RUTAS_DE_AMBOS_ROLES:
        return

    if sesion.rol != "admin":
        raise error_permiso()
    # El token dice admin, pero la cuenta pudo cambiar después de iniciar sesión
    with conexion.app.state.tidb.conexion() as con:
        cuenta = usuario_admin.buscar_por_id(con, sesion.id_admin)
    if not cuenta or not cuenta["activo"]:
        raise error_sesion()
    if cuenta["rol"] != "admin":
        raise error_permiso()
