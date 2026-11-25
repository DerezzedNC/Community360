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

Usar un solo proceso (sin `--workers`): los tokens revocados por logout viven en memoria y se pierden al reiniciar la API.

## Crear cuentas (admin o analista)

En una ventana de PowerShell, una cuenta por ejecución:

```powershell
cd C:\cummunity360\backend
.venv\Scripts\python -m scripts.crear_admin
```

Pide correo, nombre, rol y contraseña (mínimo 12 caracteres; no se ve al escribir). En TiDB solo se guarda el hash Argon2.

## Pruebas

```powershell
.venv\Scripts\python -m pytest -m "not nube"   # rápidas, sin red
.venv\Scripts\python -m pytest                 # incluye la conexión real (solo lectura)
```

Si la prueba `nube` falla, revisar que el cluster de Capella esté HEALTHY y que la IP actual esté en Allowed IP Addresses.
