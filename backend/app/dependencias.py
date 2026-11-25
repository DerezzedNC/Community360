"""Dependencias comunes de los endpoints."""
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.tokens import Sesion, TokenInvalido

COOKIE = "c360_token"


def error_sesion() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Sesión no válida o vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )


def leer_token(request: Request) -> str:
    """El Bearer gana aunque venga vacío; la cookie solo se usa si no hay Bearer."""
    esquema, _, valor = request.headers.get("Authorization", "").strip().partition(" ")
    if esquema.lower() == "bearer":
        return valor.strip()
    return request.cookies.get(COOKIE, "")


def sesion_actual(request: Request) -> Sesion:
    try:
        return request.app.state.tokens.validar(leer_token(request))
    except TokenInvalido:
        raise error_sesion() from None


SesionActual = Annotated[Sesion, Depends(sesion_actual)]
