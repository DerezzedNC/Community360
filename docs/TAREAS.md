# Tablero de tareas

Estados: `pendiente` · `en curso` · `hecho` · `bloqueada`.
Toma solo tareas de tu equipo cuyas dependencias ya estén en `hecho`. Actualiza el estado aquí mismo.

## Fase 3 · Autenticación

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F3-01 | [CC] | Base del backend: estructura de `backend/`, `requirements.txt`, lectura de `.env` con pydantic-settings, conexión a TiDB y Capella, `GET /api/health` | — | en curso |
| F3-02 | [CC] | Hash con Argon2 (`pwdlib`) y script `backend/scripts/crear_admin.py` para dar de alta un `admin` y un `analista` en `usuario_admin` (pide la contraseña por consola, nunca la guarda en texto) | F3-01 | pendiente |
| F3-03 | [CC] | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` según el contrato: JWT de 60 min, cookie httpOnly, revocación al salir, actualizar `ultimo_acceso` | F3-02 | pendiente |
| F3-04 | [CC] | Proteger todo `/api/*` (excepto login y health) y permisos por rol (`analista` solo GET). Pruebas pytest: login correcto, contraseña incorrecta, sin token, token revocado, analista intentando escribir | F3-03 | pendiente |
| F3-05 | [CC] | Colección y entorno de Postman de la Fase 3 en `postman/` | F3-04 | pendiente |
| F3-06 | [AG] | Base del frontend: React + Vite + router, proxy de Vite `/api` y `/ws` → `localhost:8000`, layout del dashboard vacío | — | en curso |
| F3-07 | [AG] | Pantalla de inicio de sesión: correo y contraseña, mensaje en 401, sin credenciales en el código | F3-06, F3-03 | pendiente |
| F3-08 | [AG] | Rutas protegidas: `/dashboard` consulta `GET /api/auth/me` y manda a `/login` si da 401; botón "Cerrar sesión" | F3-07 | pendiente |
| F3-09 | [AG] | Evidencias de la Fase 3 en `evidencias/fase3/`: login correcto, login fallido, acceso sin sesión redirigido, cierre de sesión, petición sin token en Postman (401) | F3-05, F3-08 | pendiente |

## Fase 4 · API REST (se detalla al cerrar la Fase 3)

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F4-01 | [CC] | CRUD de interacciones en Capella con validación contra TiDB | F3-04 | pendiente |
| F4-02 | [CC] | Endpoints de consulta histórica y métricas | F3-04 | pendiente |
| F4-03 | [AG] | Vistas históricas del dashboard consumiendo REST | F4-02 | pendiente |

## Fase 5 · WebSockets (se detalla al cerrar la Fase 4)

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F5-01 | [CC] | Servidor `/ws` autenticado y difusión de eventos | F4-01 | pendiente |
| F5-02 | [AG] | Cliente WebSocket y actualización de gráficas sin recargar | F5-01 | pendiente |

## Fase 6 · Dashboard (se detalla al cerrar la Fase 5)

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F6-01 | [CC] | `docs/INDICADORES.md` con la fórmula de cada indicador | F4-02 | pendiente |
| F6-02 | [AG] | Gráficas de barras, dona y mapa de calor, diseño responsivo | F5-02, F6-01 | pendiente |
