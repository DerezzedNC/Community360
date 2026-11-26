"""API de COMMUNITY 360. Arranque: uvicorn app.main:create_app --factory --port 8000"""
import logging
from contextlib import asynccontextmanager

import pymysql
from fastapi import Depends, FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from couchbase.exceptions import CouchbaseException
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.db.capella import Capella, CapellaNoDisponible
from app.db.tidb import TiDB
from app.dependencias import proteger
from app.routers import auth, catalogos, cuarentena, health, interacciones, metricas, usuarios
from app.tokens import Tokens

logger = logging.getLogger("community360")


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # Espera a Capella 10 s como máximo. Si no está, la API levanta igual y reintenta después
    await run_in_threadpool(app.state.capella.conectar, 10)
    yield
    await run_in_threadpool(app.state.capella.cerrar)
    await run_in_threadpool(app.state.tidb.cerrar)


async def error_validacion(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Sin "input" ni "ctx": podrían devolver la contraseña que envió el cliente
    errores = [{"type": e["type"], "loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errores})


async def error_tidb(request: Request, exc: Exception) -> JSONResponse:
    # Solo el tipo: el mensaje puede traer usuario y servidor
    logger.warning("TiDB no responde (%s)", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "Base de datos no disponible"})


async def error_capella(request: Request, exc: Exception) -> JSONResponse:
    # Mismo mensaje que TiDB: al cliente no le importa cuál de las dos falló
    logger.warning("Capella no responde (%s)", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "Base de datos no disponible"})


async def error_interno(request: Request, exc: Exception) -> JSONResponse:
    # Uvicorn registra la traza; al cliente no se le dan detalles
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


def create_app(
    settings: Settings | None = None,
    tidb: TiDB | None = None,
    capella: Capella | None = None,
) -> FastAPI:
    """Sin argumentos usa backend/.env. Las pruebas pasan su propia configuración."""
    settings = settings or get_settings()
    app = FastAPI(
        title="COMMUNITY 360",
        version="0.10",
        lifespan=ciclo_de_vida,
        # Protegido por defecto: las rutas públicas están en dependencias.py
        dependencies=[Depends(proteger)],
    )
    app.state.settings = settings
    app.state.tidb = tidb or TiDB(settings)
    app.state.capella = capella or Capella(settings)
    app.state.tokens = Tokens(settings)

    app.add_exception_handler(RequestValidationError, error_validacion)
    app.add_exception_handler(pymysql.err.OperationalError, error_tidb)
    app.add_exception_handler(pymysql.err.InterfaceError, error_tidb)
    app.add_exception_handler(CapellaNoDisponible, error_capella)
    app.add_exception_handler(CouchbaseException, error_capella)
    app.add_exception_handler(Exception, error_interno)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(catalogos.router)
    app.include_router(usuarios.router)
    app.include_router(metricas.router)
    app.include_router(cuarentena.router)
    app.include_router(interacciones.router)
    return app
