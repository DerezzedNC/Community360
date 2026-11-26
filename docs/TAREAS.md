# Tablero de tareas

Estados: `pendiente` · `en curso` · `hecho` · `bloqueada` · `pospuesta` (se hará más adelante por decisión de Angel; no se toma mientras tanto).
Toma solo tareas de tu equipo cuyas dependencias ya estén en `hecho`. Actualiza el estado aquí mismo.

## Fase 3 · Autenticación

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F3-01 | [CC] | Base del backend: estructura de `backend/`, `requirements.txt`, lectura de `.env` con pydantic-settings, conexión a TiDB y Capella, `GET /api/health`. **Nota:** health 200 con Capella real verificado en VER-01 | — | hecho |
| F3-02 | [CC] | Hash con Argon2 (`pwdlib`) y script `backend/scripts/crear_admin.py` para dar de alta un `admin` y un `analista` en `usuario_admin` (pide la contraseña por consola, nunca la guarda en texto) | F3-01 | hecho |
| F3-03 | [CC] | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` según el contrato: JWT de 60 min, cookie httpOnly, revocación al salir, actualizar `ultimo_acceso` | F3-02 | hecho |
| F3-04 | [CC] | Proteger todo `/api/*` (excepto login y health) y permisos por rol (`analista` solo GET). Pruebas pytest: login correcto, contraseña incorrecta, sin token, token revocado, analista intentando escribir | F3-03 | hecho |
| F3-05 | [CC] | Colección y entorno de Postman de la Fase 3 en `postman/` | F3-04 | hecho |
| F3-06 | [AG] | Base del frontend: React + Vite + router, proxy de Vite `/api` y `/ws` → `localhost:8000`, layout del dashboard vacío | — | hecho |
| F3-07 | [AG] | Pantalla de inicio de sesión: correo y contraseña, mensaje en 401, sin credenciales en el código | F3-06, F3-03 | hecho |
| F3-08 | [AG] | Rutas protegidas: `/dashboard` consulta `GET /api/auth/me` y manda a `/login` si da 401; botón "Cerrar sesión" | F3-07 | hecho |
| F3-09 | [AG] | Evidencias de la Fase 3 en `evidencias/fase3/`: login correcto, login fallido, acceso sin sesión redirigido, cierre de sesión, petición sin token en Postman (401). **Nota:** las capturas se toman al armar el documento | F3-05, F3-08 | pospuesta |

## Fase 4 · API REST

Las tareas F4-02 y F4-03 son de **solo lectura** y no dependen de la lista mínima de endpoints que falta confirmar con el profesor. F4-01 (altas, cambios y bajas) sí espera esa lista.

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F4-00 | [AG] | Estructura del dashboard y componentes de gráficas | — | hecho |
| F4-01 | [CC] | CRUD de interacciones en Capella con validación contra TiDB | F3-04 | pendiente |
| F4-02a | [CC] | `GET /api/catalogos`: los 8 catálogos de TiDB | F3-04 | hecho |
| F4-02b | [CC] | `GET /api/usuarios` (paginado y con filtros) y `GET /api/usuarios/{id_usuario}`. `ubicacion` es `null` sin consentimiento, con prueba que lo garantice | F4-02a | hecho |
| F4-04 | [CC] | Pool de conexiones a TiDB (pocas conexiones, ping antes de usar, renovación antes del cierre por inactividad) | F4-02b | hecho |
| F4-02c | [CC] | `docs/INDICADORES.md`, primera versión: definición y fórmula de cada dato de `/api/metricas/*`, antes de programarlo | F3-04 | hecho |
| F4-02d | [CC] | Métricas de TiDB: `GET /api/metricas/estatus` y `GET /api/metricas/geografia` (solo con consentimiento) | F4-02c | hecho |
| F4-02e | [CC] | Métricas que usan Capella: `GET /api/metricas/temas`, `/actividad`, `/plataformas` y `/resumen`. Incluye la consulta a Capella y su `503` | F4-02c, F4-02d | hecho |
| F4-02f | [CC] | `GET /api/cuarentena` (paginado, filtro `motivo`). Revisar antes qué campos se muestran por privacidad | F4-02e | hecho |
| F4-03a | [AG] | Navegación de las vistas históricas y carga de catálogos (nombres legibles y opciones de los filtros) | F3-08, F4-02a | en curso |
| F4-03b | [AG] | Vista de usuarios: tabla paginada, filtros y detalle. Ubicación solo si la API la da | F4-03a, F4-02b | pendiente |
| F4-03c | [AG] | Gráficas históricas de estatus (dona) y geografía (barras) | F4-03a, F4-02d | pendiente |
| F4-03d | [AG] | Tarjetas de resumen y gráficas históricas de plataformas, temas y actividad (mapa de calor día × hora) | F4-03a, F4-02e | pendiente |
| F4-03e | [AG] | Vista de cuarentena: tabla paginada y filtro por motivo | F4-03a, F4-02f | pendiente |

## Fase 5 · WebSockets (se detalla al cerrar la Fase 4)

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F5-01 | [CC] | Servidor `/ws` autenticado y difusión de eventos | F4-01 | pendiente |
| F5-02 | [AG] | Cliente WebSocket y actualización de gráficas sin recargar | F5-01 | pendiente |

## Fase 6 · Dashboard (se detalla al cerrar la Fase 5)

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| F6-01 | [CC] | `docs/INDICADORES.md` completo: indicadores dinámicos y cómo cambian con altas, cambios y bajas (parte de la versión de F4-02c) | F4-02e | pendiente |
| F6-02 | [AG] | Gráficas de barras, dona y mapa de calor, diseño responsivo | F5-02, F6-01 | pendiente |

## Verificaciones pendientes

| ID | Equipo | Tarea | Depende de | Estado |
|---|---|---|---|---|
| VER-01 | [CC] | Verificar con Capella real desde una red sin bloqueo (health 200 y `pytest -m nube`) | — | hecho |

VER-01 se resolvió el 2026-11-24. Lo que se comprobó con la base real:

- [x] F3-01 · `GET /api/health` responde `200` con `{"estado": "ok", "tidb": true, "capella": true}`.
- [x] F3-01 · `pytest -m nube` pasa.
- [x] F3-01 · Capella acepta el usuario y la contraseña, y se puede leer la colección `interacciones` (203 documentos; `cuarentena`, 797).
- [x] F3-01 · La API se reconecta sola: levantarla sin Capella (`503`) y, al volver la conexión, `health` pasa a `200` sin reiniciar (se usó una dirección que no contesta y luego la real; tardó unos 2 min, lo que tarda el SDK en abandonar el intento anterior).
