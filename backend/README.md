# backend · [CC] Claude Code

API FastAPI de COMMUNITY 360. Puerto 8000. El contrato está en `docs/CONTRATO_API.md`.

`.env` ya tiene las credenciales; `.env.example` lista las variables sin valores.

## Preparar (una sola vez, en PowerShell)

```powershell
cd C:\cummunity360\backend
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

## Levantar la API

```powershell
cd C:\cummunity360\backend
.venv\Scripts\python -m uvicorn app.main:create_app --factory --port 8000
```

Comprobar: `curl.exe -i http://localhost:8000/api/health`

Si Capella está apagada, la API levanta de todos modos, `health` responde `503` y se vuelve a conectar sola cuando el cluster regresa.

## Pruebas

```powershell
.venv\Scripts\python -m pytest -m "not nube"   # rápidas, sin red
.venv\Scripts\python -m pytest                 # incluye la conexión real (solo lectura)
```

Mientras VER-01 (`docs/TAREAS.md`) siga bloqueada, la prueba `nube` falla porque no hay conexión con Capella: usar la primera.
