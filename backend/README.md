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

## Despliegue (Render)

Un solo servicio web con Docker: la API sirve también el build del frontend, así que página, API y WebSocket quedan en el mismo dominio (`https://<servicio>.onrender.com`). Archivos: `Dockerfile`, `.dockerignore` y `render.yaml`, en la raíz del repositorio.

- La imagen construye `frontend/` con Node y corre `uvicorn app.main:create_app --factory --host 0.0.0.0 --port $PORT --proxy-headers`.
- Cualquier `GET` que no sea de `/api` ni de `/ws` devuelve un archivo de `frontend/dist` o `index.html` (así `/dashboard` funciona al recargar). `/api/*` sigue protegido igual.
- Render revisa la salud con `/` (no con `/api/health`), para no reiniciar el servicio si Capella tarda.

### Crear el servicio

1. En Render: **New → Blueprint** y elegir este repositorio. Render lee `render.yaml`.
2. Render pide las variables marcadas con `sync: false`. Se llenan **solo en el panel de Render**, nunca en archivos del repositorio.
3. Al terminar el primer despliegue, copiar la URL pública y ponerla en `FRONTEND_ORIGEN` (si no se conocía al crear el servicio). Guardar: Render vuelve a desplegar.
4. Permitir la salida de Render en las bases: en el panel del servicio, **Connect → Outbound**, copiar los rangos de IP y agregarlos en Capella (*Allowed IP Addresses*) y, si TiDB tiene reglas de firewall, también ahí. Sin eso, `/api/health` responde `503`.
5. Comprobar: `https://<servicio>.onrender.com/api/health` → `200`, y abrir `https://<servicio>.onrender.com`.

### Variables que van en Render

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `TIDB_HOST` | Host de TiDB Cloud | sí |
| `TIDB_USER` | Usuario de TiDB | sí |
| `TIDB_PASSWORD` | Contraseña de TiDB | sí |
| `CB_CONN` | Cadena `couchbases://…` de Capella | sí |
| `CB_USER` | Usuario de acceso de Capella | sí |
| `CB_PASSWORD` | Contraseña de Capella | sí |
| `JWT_SECRET` | Clave aleatoria de 32 caracteres o más (una nueva, no la del `.env` local) | sí |
| `FRONTEND_ORIGEN` | URL pública exacta, con `https://` y sin `/` al final | no, pero sin ella el WebSocket del dashboard cierra con `4403` |
| `COOKIE_SECURE` | `true` (ya viene en `render.yaml`) | no |

Opcionales, con su valor por omisión: `TIDB_PORT=4000`, `TIDB_DB=community360`, `CB_BUCKET=Community360`, `CB_SCOPE=app`, `JWT_MINUTOS=60`.

### Postman contra la URL pública

1. En el entorno **COMMUNITY 360**, cambiar el *Current value* de `c360_base_url` a `https://<servicio>.onrender.com` (sin `/` al final). No cambiar el *Initial value*: así el archivo del proyecto sigue apuntando a `localhost`.
2. Enviar las peticiones igual que en local. Las cuentas son las mismas (están en TiDB).
3. WebSocket: `wss://<servicio>.onrender.com/ws/metricas` con `Authorization: Bearer {{c360_token}}`.

### Avisos del plan gratis

- El servicio se duerme tras unos 15 minutos sin uso; la primera petición tarda cerca de un minuto. Abrir la página un rato antes de la demostración.
- Al dormirse o redesplegar se reinicia: los tokens revocados por logout (en memoria) se pierden, así que la petición 7 de Postman necesita 4 y 6 en la misma sesión del servidor.
