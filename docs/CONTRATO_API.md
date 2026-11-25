# Contrato de la API · COMMUNITY 360

**Versión 0.1** (Fase 3 cerrada en diseño; Fases 4 y 5 son propuesta pendiente de confirmar con el profesor).
Este documento lo mantiene **[CC]**. **[AG]** lo consume tal cual. Cualquier cambio sube la versión y se anota en `docs/BITACORA.md`.

## Generalidades

- Backend: `http://localhost:8000`. Frontend: `http://localhost:5173`, que reenvía `/api` y `/ws` al backend con el proxy de Vite (así cookie y API quedan en el mismo origen).
- Todo el cuerpo va en JSON (`Content-Type: application/json`), en UTF-8.
- Fechas en ISO 8601 y UTC: `2026-10-28T16:59:03Z`.
- Errores siempre con la forma `{"detail": "mensaje"}`. Los de validación (422) usan el formato estándar de FastAPI.

### Autenticación en cada petición

El backend acepta el token de dos formas (en este orden):

1. Cookie `c360_token` (httpOnly, `SameSite=Lax`, `Path=/`). La usa el dashboard.
2. Encabezado `Authorization: Bearer <token>`. Lo usa Postman.

| Código | Cuándo |
|---|---|
| 401 | Sin token, token vencido, firma inválida o token revocado por logout |
| 403 | Token válido pero el rol no tiene permiso (por ejemplo, `analista` intentando escribir) |

### Roles

| Rol | Puede |
|---|---|
| `admin` | Todo lo de `analista` + crear, editar y borrar interacciones |
| `analista` | Solo consultas (`GET`) y el WebSocket |

---

## Fase 3 · Autenticación

### `GET /api/health` (pública)
`200` → `{"estado": "ok", "tidb": true, "capella": true}`

### `POST /api/auth/login` (pública)
Cuerpo:
```json
{ "correo": "admin@community360.mx", "password": "********" }
```
Respuestas:
- `200` + cookie `c360_token`:
```json
{
  "token": "<jwt>",
  "tipo": "bearer",
  "expira_en": 3600,
  "usuario": { "id_admin": 1, "nombre": "Angel Noh", "correo": "admin@community360.mx", "rol": "admin" }
}
```
- `401` → `{"detail": "Correo o contraseña incorrectos"}`. El mismo mensaje si el correo no existe, la contraseña no coincide o la cuenta está inactiva, para no revelar cuál fue.
- `422` → falta un campo o el correo no tiene formato válido.

Reglas: comparar con `password_hash` usando Argon2; si entra, actualizar `ultimo_acceso`. El JWT lleva `sub` (id_admin), `rol`, `jti` (id único) y `exp` (60 min).

### `GET /api/auth/me` (requiere sesión)
`200` → el mismo objeto `usuario` del login. `401` si no hay sesión válida.

### `POST /api/auth/logout` (requiere sesión)
`204` sin cuerpo. Borra la cookie y agrega el `jti` a la lista de tokens revocados hasta que venza. Después de esto el mismo token debe responder `401`.

---

## Fase 4 · API REST (propuesta)

### Interacciones (Couchbase Capella)

| Método y ruta | Rol | Respuestas |
|---|---|---|
| `GET /api/interacciones` | ambos | `200` lista paginada |
| `GET /api/interacciones/{id_interaccion}` | ambos | `200` · `404` |
| `POST /api/interacciones` | admin | `201` creada · `409` id repetido · `422` datos inválidos |
| `PUT /api/interacciones/{id_interaccion}` | admin | `200` · `404` · `422` |
| `DELETE /api/interacciones/{id_interaccion}` | admin | `204` · `404` |

Filtros de `GET /api/interacciones`: `id_usuario`, `canal`, `tipo`, `tema`, `desde`, `hasta`, `pagina` (1), `limite` (50, máximo 200).
```json
{ "total": 203, "pagina": 1, "limite": 50, "datos": [ { "id_interaccion": "I0001825", "id_usuario": "U000852", "timestamp": "2026-10-28T16:59:03Z", "canal": "facebook", "tipo": "comentario", "tema": "musica", "texto": "...", "longitud_texto": 44, "sentimiento": 0.86, "idioma": "es", "dispositivo": "android", "reacciones_recibidas": 2, "etiquetas": [] } ] }
```

Validaciones de `POST` y `PUT` (si falla alguna → `422` con el campo y el motivo):
- `id_usuario` existe en `usuario` (TiDB). La interacción no puede ser anterior a su `fecha_ingreso`.
- `canal`, `tipo`, `tema`, `dispositivo` y cada etiqueta existen y están activos en su catálogo de TiDB.
- `sentimiento` entre -1 y 1; `reacciones_recibidas` entero ≥ 0; `idioma` en `es`, `en`, `pt`.
- Si el tipo no admite texto (`reaccion`), no lleva `texto`. Si lo admite, `texto` es obligatorio y `longitud_texto` lo calcula el servidor.
- No se aceptan campos geográficos (`pais`, `estado`, `ciudad`, `latitud`, `longitud`).
- `id_interaccion` es opcional en `POST`: si no viene, el servidor genera el siguiente (`I` + 7 dígitos).

### Consultas históricas (TiDB + Capella)

| Ruta | Devuelve |
|---|---|
| `GET /api/usuarios` | Padrón paginado. Filtros: `estatus`, `plataforma`, `especie`, `interes`. Sin ubicación para quien no dio consentimiento |
| `GET /api/usuarios/{id_usuario}` | Un usuario; `ubicacion` es `null` si no dio consentimiento |
| `GET /api/catalogos` | Todos los catálogos con código y nombre |
| `GET /api/metricas/resumen` | Totales e indicadores principales (ver `docs/INDICADORES.md`) |
| `GET /api/metricas/estatus` | Usuarios por estatus (activo, en riesgo, inactivo) |
| `GET /api/metricas/plataformas` | Usuarios e interacciones por plataforma |
| `GET /api/metricas/temas` | Interacciones y sentimiento promedio por tema |
| `GET /api/metricas/actividad` | Mapa de calor: interacciones por día de la semana × hora |
| `GET /api/metricas/geografia` | Usuarios por estado y ciudad, **solo** con consentimiento |
| `GET /api/cuarentena` | Registros rechazados. Filtro: `motivo` |

---

## Fase 5 · WebSocket (propuesta)

Ruta: `ws://localhost:5173/ws` en el dashboard (proxy) o `ws://localhost:8000/ws` directo. Autenticación con la cookie `c360_token` o con `?token=<jwt>`. Sin sesión válida el servidor cierra con el código `4401`.

Mensajes del servidor al cliente:
```json
{ "evento": "interaccion.creada",      "datos": { "id_interaccion": "I0002001", "...": "..." }, "ts": "2026-11-24T20:15:00Z" }
{ "evento": "interaccion.actualizada", "datos": { "id_interaccion": "I0002001", "...": "..." }, "ts": "..." }
{ "evento": "interaccion.eliminada",   "datos": { "id_interaccion": "I0002001" }, "ts": "..." }
{ "evento": "metricas.actualizadas",   "datos": { "...": "mismo formato que GET /api/metricas/resumen" }, "ts": "..." }
```
Cada `POST`, `PUT` o `DELETE` exitoso envía primero el evento de la interacción y luego `metricas.actualizadas`.

Mensajes del cliente al servidor: `{"tipo": "ping"}` → el servidor contesta `{"evento": "pong"}`.
