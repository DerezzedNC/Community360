"""API de COMMUNITY 360. Arranque: uvicorn app.main:create_app --factory --port 8000"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.db.capella import Capella
from app.db.tidb import TiDB
from app.routers import health


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # Espera a Capella 10 s como máximo. Si no está, la API levanta igual y reintenta después
    await run_in_threadpool(app.state.capella.conectar, 10)
    yield
    await run_in_threadpool(app.state.capella.cerrar)


def create_app(
    settings: Settings | None = None,
    tidb: TiDB | None = None,
    capella: Capella | None = None,
) -> FastAPI:
    """Sin argumentos usa backend/.env. Las pruebas pasan su propia configuración."""
    settings = settings or get_settings()
    app = FastAPI(title="COMMUNITY 360", version="0.2", lifespan=ciclo_de_vida)
    app.state.settings = settings
    app.state.tidb = tidb or TiDB(settings)
    app.state.capella = capella or Capella(settings)

    @app.exception_handler(Exception)
    async def error_interno(request: Request, exc: Exception) -> JSONResponse:
        # Uvicorn registra la traza; al cliente no se le dan detalles
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

    app.include_router(health.router)
    return app
