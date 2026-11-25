"""Estado del servicio y de las dos bases de datos. Ruta pública."""
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["salud"])


class Salud(BaseModel):
    estado: str
    tidb: bool
    capella: bool


@router.get("/health", responses={503: {"model": Salud}})
def health(request: Request, response: Response) -> Salud:
    tidb = request.app.state.tidb.probar()
    capella = request.app.state.capella.probar()
    todo_bien = tidb and capella
    if not todo_bien:
        response.status_code = 503
    return Salud(estado="ok" if todo_bien else "degradado", tidb=tidb, capella=capella)
