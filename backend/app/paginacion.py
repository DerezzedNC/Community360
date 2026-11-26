"""Parámetros de paginación comunes (contrato: fuera de rango → 422, nunca se recortan)."""
from typing import Annotated

from fastapi import Query

LIMITE_MAXIMO = 200

Pagina = Annotated[int, Query(ge=1)]
Limite = Annotated[int, Query(ge=1, le=LIMITE_MAXIMO)]
