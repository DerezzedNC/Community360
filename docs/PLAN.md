# Plan de trabajo · Fases 3 a 6

Fuente: `docs/especificacion/COMMUNITY 360 BDEN.pdf`. Las fases 1 y 2 ya están entregadas y aceptadas.

## Lo que ya existe y se reutiliza

- **TiDB Cloud Starter** (base `community360`): catálogos, geografía, `usuario`, `ubicacion_usuario`, `usuario_admin` (vacía) y `bitacora_carga`. Modelo v3 con CHECK, UNIQUE y llaves foráneas.
- **Couchbase Capella**: bucket `Community360`, scope `app`, colecciones `interacciones` (203 docs) y `cuarentena` (797 docs).
- **ETL** en `etl/` (Fase 2). No se toca.

## Fase 3 · Autenticación

Lo que pide la guía y cómo se cumple:

| Requisito | Cómo se cumple | Equipo |
|---|---|---|
| Validar credenciales contra la base en la nube | `POST /api/auth/login` consulta `usuario_admin` en TiDB | CC |
| Contraseñas con hash seguro | Argon2 con `pwdlib`; la columna `password_hash` nunca guarda texto plano | CC |
| Sesiones o tokens | JWT firmado (60 min) en cookie httpOnly; también se acepta `Authorization: Bearer` para Postman | CC |
| Proteger rutas del dashboard | El frontend llama a `GET /api/auth/me`; si responde 401 manda a `/login` | AG |
| Validar autenticación en los endpoints REST | Dependencia común en FastAPI: todo `/api/*` excepto login y health pide token | CC |
| Cierre de sesión | `POST /api/auth/logout` borra la cookie y revoca el token; botón en el dashboard | CC + AG |
| Credenciales en variables de entorno | `backend/.env` (no se sube); el frontend no conoce ninguna credencial | CC |

Roles: `admin` (puede crear, editar y borrar interacciones desde Postman) y `analista` (solo consulta).

## Fase 4 · API REST

Consultas históricas y administración de interacciones (CRUD en Capella) con validación contra los catálogos y el padrón de TiDB, y códigos HTTP correctos. Detalle en `docs/CONTRATO_API.md`.

> La tabla de "como mínimo, deberá contemplar" no viene en el PDF que tenemos. El contrato tiene una propuesta; hay que confirmarla con el profesor.

## Fase 5 · WebSockets

Canal `/ws` autenticado. Cada alta, cambio o baja de una interacción hecha desde Postman se avisa a todos los dashboards conectados, junto con los indicadores recalculados. El dashboard no lleva formularios.

> La tabla de condiciones de la Fase 5 tampoco viene en el PDF; confirmar con el profesor.

## Fase 6 · Dashboard analítico

- Indicadores en tiempo real (WebSocket) con definición matemática en `docs/INDICADORES.md`.
- Gráficas de barras, dona y mapa de calor, entre otras.
- Vistas históricas con datos reales de la nube (REST).
- Evidencias: petición, respuesta HTTP y cambio en el dashboard.

## Orden de trabajo

1. CC y AG arrancan en paralelo: CC hace la base del backend y AG la base del frontend.
2. CC termina login, logout y protección de rutas; AG conecta la pantalla de login a esos endpoints.
3. Con la Fase 3 funcionando de punta a punta, se toman evidencias y se pasa a la Fase 4.
