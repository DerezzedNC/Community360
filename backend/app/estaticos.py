"""El build del frontend (frontend/dist) servido por la misma API: un solo servicio y un solo dominio.

No agrega rutas a la API. Funciona como respaldo del 404: si ninguna ruta reconoce un GET
que no es de /api ni de /ws, se devuelve el archivo pedido o index.html (para que /dashboard
funcione al recargar). Por eso la protección de /api/* no cambia: esas rutas siguen igual.
"""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

PREFIJOS_DEL_BACKEND = ("/api", "/ws")
METODOS_DE_LECTURA = {"GET", "HEAD"}


def es_del_backend(ruta: str) -> bool:
    return any(ruta == prefijo or ruta.startswith(prefijo + "/") for prefijo in PREFIJOS_DEL_BACKEND)


def servir_frontend(app: FastAPI, carpeta: Path) -> None:
    carpeta = Path(carpeta).resolve()
    indice = carpeta / "index.html"
    if not indice.is_file():
        return  # sin build (desarrollo): el frontend lo sirve Vite en el puerto 5173

    # Los archivos de assets/ llevan un hash en el nombre; si falta uno, es un 404 de verdad
    if (carpeta / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=carpeta / "assets"), name="assets")

    async def respaldo_del_frontend(request: Request, exc: HTTPException):
        ruta = request.scope["path"]
        if (
            request.method not in METODOS_DE_LECTURA
            or es_del_backend(ruta)
            or ruta.startswith("/assets/")
        ):
            # El 404 de siempre, en JSON
            return await http_exception_handler(request, exc)
        archivo = (carpeta / ruta.lstrip("/")).resolve()
        # is_relative_to impide salir de dist con "../"
        if archivo != carpeta and archivo.is_relative_to(carpeta) and archivo.is_file():
            return FileResponse(archivo)
        # no-cache: después de un despliegue el navegador pide la versión nueva
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})

    app.add_exception_handler(404, respaldo_del_frontend)
