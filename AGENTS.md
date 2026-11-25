# COMMUNITY 360 · Reglas para todos los agentes

Este proyecto lo trabajan **dos equipos de agentes al mismo tiempo** sobre esta misma carpeta:

| Equipo | Herramienta | Prefijo | Dueño de |
|---|---|---|---|
| Claude Code | Claude Code (terminal) | `[CC]` | `backend/`, `postman/`, `docs/CONTRATO_API.md`, `docs/INDICADORES.md` |
| Antigravity | Agentes de Google Antigravity | `[AG]` | `frontend/`, `evidencias/` |

Angel (el alumno) es quien decide. Si algo no está claro o una tarea pide salirse de estas reglas, **pregunta a Angel antes de actuar**.

## Antes de empezar cualquier trabajo

1. Lee `docs/PLAN.md` (qué se entrega en cada fase) y `docs/TAREAS.md` (quién hace qué).
2. Toma **solo** tareas con tu prefijo y en estado `pendiente` cuyas dependencias ya estén en `hecho`.
3. Cambia la tarea a `en curso` en `docs/TAREAS.md` antes de tocar código.

## Al terminar una tarea

1. Cambia la tarea a `hecho` en `docs/TAREAS.md`.
2. Agrega una entrada al final de `docs/BITACORA.md`: fecha, prefijo, tarea, qué cambió, cómo se prueba y si el otro equipo necesita hacer algo.
3. Si usas git: un commit por tarea, con el mensaje `[CC] F3-01 ...` o `[AG] F3-06 ...`.

## Git y GitHub

- Repositorio remoto: `origin` (GitHub, privado), rama `master`.
- Un commit por tarea y `git push` a `origin master` al terminarla. Antes del push, `git pull --rebase` por si el otro equipo subió algo.
- Cada commit lleva solo los archivos de tu tarea. No incluyas cambios del otro equipo que veas pendientes en la carpeta.
- Nunca se suben `.env`, datos de origen (`etl/datos/`) ni entregas en PDF (`docs/especificacion/*.pdf`). Ya están en `.gitignore`: no los fuerces con `git add -f`.
- Nunca reescribas el historial ni hagas `git push --force` sin permiso de Angel.
- Si el push pide iniciar sesión, avisa a Angel para que lo haga él en el navegador. Nunca pidas ni uses tokens en el chat.

## Reglas de colaboración

- **No edites la carpeta del otro equipo.** Si necesitas un cambio allá, escríbelo en `docs/BITACORA.md` con la etiqueta `PETICIÓN →CC` o `PETICIÓN →AG` y sigue con otra tarea.
- **El contrato manda.** `docs/CONTRATO_API.md` define rutas, cuerpos JSON, códigos HTTP y eventos WebSocket. El backend lo implementa tal cual y el frontend lo consume tal cual. Si hay que cambiarlo, lo cambia `[CC]`, sube la versión del contrato y lo anota en la bitácora.
- **Datos reales, nunca simulados.** El dashboard solo muestra datos que vienen de TiDB Cloud y Couchbase Capella a través de la API. Nada de valores fijos ni datos inventados, ni siquiera "temporales".
- **El dashboard es de solo lectura.** No lleva formularios para crear, editar o borrar interacciones. Esas operaciones se hacen desde Postman durante la demostración.

## Seguridad (obligatorio)

- Credenciales y cadenas de conexión **solo** en `backend/.env`. Nunca en código, en el frontend, en la documentación ni en mensajes de commit.
- Nunca leas en voz alta, copies ni muestres el contenido de ningún `.env`.
- Contraseñas siempre con hash (Argon2). Nunca en texto plano, ni en logs.
- El frontend nunca habla directo con TiDB o Capella: todo pasa por la API.

## Datos del proyecto que no se deben romper

- Las tablas de TiDB (base `community360`) ya existen y tienen datos cargados por `etl/`. **No** borres tablas ni datos, y no cambies el esquema sin una tarea que lo pida.
- Couchbase: bucket `Community360` (con C mayúscula), scope `app`, colecciones `interacciones` y `cuarentena`.
- Privacidad: los usuarios con `consentimiento_datos = FALSE` no tienen ubicación. Ningún endpoint ni gráfica puede mostrar o inferir su ubicación.
- `etl/` es la Fase 2 ya entregada: no se modifica.

## Stack acordado

- Backend: Python 3.13, FastAPI, Uvicorn, PyMySQL, SDK de Couchbase, PyJWT, pwdlib[argon2], pytest. Puerto **8000**.
- Frontend: React + Vite, ECharts para gráficas. Puerto **5173**, con proxy de Vite hacia `/api` y `/ws` del backend.
- Idioma: código y comentarios en español sencillo; nombres de variables iguales a los de la base de datos.
