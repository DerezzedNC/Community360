# Contrato de la API · COMMUNITY 360

**Versión 0.14** (Fases 3 a 6 definidas: autenticación, consultas, métricas, cuarentena, CRUD de interacciones, WebSocket y métricas adicionales del dashboard).

| Versión | Cambio |
|---|---|
| 0.14 | `GET /api/metricas/tipos` y `GET /api/metricas/etiquetas` (top 10), de Capella con nombres de los catálogos (F6-05) |
| 0.13 | WebSocket bidireccional: el cliente pide `{"accion": "actualizar"}`; un mensaje desconocido recibe `evento: error` sin cerrar; `metricas.actualizadas` trae `cambio` (F6-04) |
| 0.12 | `GET /api/metricas/puntos-calientes`: mapa de calor en cuadros de 0.2°, solo el centro de cada cuadro y sin cuadros de menos de 3; excepción a la regla de coordenadas (F6-03) |
| 0.11 | WebSocket `/ws/metricas`: resumen al conectarse y después de cada cambio del CRUD; cierres `4401` y `4403` (F5-01) |
| 0.10 | CRUD de interacciones definido: cuerpo cerrado (otro campo → `422`), borrado físico, formato de `404`, `409` y `422` (F4-01) |
| 0.9 | `GET /api/cuarentena` definido: paginado, filtro `motivo`, `registro` sin geografía (F4-02f) |
| 0.8 | `GET /api/metricas/*` definidos; geografía oculta grupos de menos de 3 usuarios; `503` también si Capella no responde (F4-02c, d y e) |
| 0.7 | El `503` de TiDB también aplica si las conexiones del pool siguen ocupadas después de 10 s (F4-04) |
| 0.6 | `GET /api/usuarios` y `GET /api/usuarios/{id_usuario}` definidos; reglas generales de paginación (`422` fuera de rango) y de privacidad (nunca coordenadas) (F4-02b) |
| 0.5 | `GET /api/catalogos` definido: formato, orden, códigos inactivos con `activo: false` y sin geografía (F4-02a) |
| 0.4 | Protección de `/api/*`, cuerpo del `403` y permisos por rol (F3-04) |
Este documento lo mantiene **[CC]**. **[AG]** lo consume tal cual. Cualquier cambio sube la versión y se anota en `docs/BITACORA.md`.

## Generalidades

- Backend: `http://localhost:8000`. Frontend: `http://localhost:5173`, que reenvía `/api` y `/ws` al backend con el proxy de Vite (así cookie y API quedan en el mismo origen).
- Todo el cuerpo va en JSON (`Content-Type: application/json`), en UTF-8.
- Fechas en ISO 8601 y UTC: `2026-10-28T16:59:03Z`.
- Errores siempre con la forma `{"detail": "mensaje"}`. Los de validación (422) usan el formato de FastAPI, pero cada error trae solo `type`, `loc` y `msg`: nunca se devuelve lo que envió el cliente.
- Si TiDB no responde, cualquier ruta que la necesite contesta `503` → `{"detail": "Base de datos no disponible"}`. `GET /api/health` tiene su propio formato. La API reutiliza hasta 4 conexiones a TiDB; si las 4 siguen ocupadas después de 10 s, también responde ese `503`.

### Paginación (todas las listas)

- Parámetros `pagina` (desde 1; por omisión 1) y `limite` (de 1 a 200; por omisión 50).
- `pagina` menor a 1, `limite` menor a 1 o mayor a 200, o un valor que no sea entero → `422`. **No se recortan en silencio.**
- Respuesta: `{"total": <filas que cumplen los filtros>, "pagina": 1, "limite": 50, "datos": [...]}`.
- Una página después de la última responde `200` con `datos: []` y el `total` real.

### Privacidad (todas las rutas)

- Un usuario con `consentimiento_datos = FALSE` **nunca** tiene ubicación en una respuesta: `ubicacion` es `null`, aunque existiera una fila suya en `ubicacion_usuario`. Ninguna ruta permite filtrar ni ordenar por ubicación.
- **La API nunca devuelve coordenadas de un usuario** (`latitud`, `longitud`), ni siquiera con consentimiento. La ubicación de un usuario llega como máximo hasta ciudad.
- Única excepción, agregada: `GET /api/metricas/puntos-calientes` devuelve el **centro de cuadros de 0.2°** (unos 22 km) con el número de usuarios con consentimiento que hay en cada uno. Nunca la coordenada de un usuario ni `id_usuario`, y **ningún cuadro con menos de 3 usuarios**. Los cuadros se calculan dentro de TiDB: las coordenadas sueltas no llegan ni a la API.

### Autenticación en cada petición

Todo `/api/*` pide sesión, menos `GET /api/health` y `POST /api/auth/login`. Una ruta nueva queda protegida aunque no se indique nada.

El backend acepta el token de dos formas (en este orden):

1. Encabezado `Authorization: Bearer <token>`. Lo usa Postman. Si viene, es el único que cuenta, aunque esté vacío o no sea válido: en ese caso responde `401` sin mirar la cookie.
2. Cookie `c360_token` (httpOnly, `SameSite=Lax`, `Path=/`). La usa el dashboard. Solo se lee si no hay `Bearer`.

| Código | Cuándo |
|---|---|
| 401 | Sin token, token vencido, firma inválida o token revocado por logout: `{"detail": "Sesión no válida o vencida"}` |
| 403 | Sesión válida pero el rol no tiene permiso (por ejemplo, `analista` intentando escribir): `{"detail": "Tu rol no permite esta operación"}` |

Orden de las revisiones: `401`, después `403` y al final `404` o `422` por los datos. Dos excepciones: un JSON mal formado puede dar `422` antes que `401`, y una ruta que no existe da `404` (o `405` si existe con otro método) sin pedir sesión.

### Roles

| Rol | Puede |
|---|---|
| `admin` | Todo lo de `analista` + crear, editar y borrar interacciones |
| `analista` | Solo consultas (`GET`), cerrar su sesión (`POST /api/auth/logout`) y el WebSocket |

Decisión (F3-04), para cuentas que cambian mientras su token sigue vigente (60 min como máximo):

- **Las lecturas (`GET`) confían en el token**, para no sumar una consulta a TiDB en cada petición del dashboard. Excepción: `GET /api/auth/me`, que siempre lee TiDB. Una cuenta desactivada puede seguir consultando hasta que su token venza.
- **Las escrituras (`POST`, `PUT`, `PATCH`, `DELETE`) revisan además en TiDB** que la cuenta siga activa y sea `admin`: `401` si ya no existe o está inactiva, `403` si ya no es `admin`, `503` si TiDB no responde. `logout` no hace esta revisión.
- El token también debe ser de `admin`: si un `analista` pasa a ser `admin`, tiene que iniciar sesión otra vez para poder escribir.

---

## Fase 3 · Autenticación

### `GET /api/health` (pública)
- `200` → las dos bases responden: `{"estado": "ok", "tidb": true, "capella": true}`
- `503` → falta al menos una; `tidb` y `capella` dicen cuál: `{"estado": "degradado", "tidb": true, "capella": false}`

El `503` de esta ruta trae el objeto de estado, no `{"detail": ...}`.

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
- `422` → falta un campo, el correo no tiene formato válido (no se admiten acentos ni ñ) o la contraseña está vacía o pasa de 1024 caracteres.
- `503` → TiDB no responde.

Reglas: comparar con `password_hash` usando Argon2; si entra, actualizar `ultimo_acceso`. El JWT lleva `sub` (id_admin), `rol`, `jti` (id único) y `exp` (60 min).

### `GET /api/auth/me` (requiere sesión)
`200` → el mismo objeto `usuario` del login, leído de TiDB. `401` si no hay sesión válida o si la cuenta ya no existe o fue desactivada. `503` si TiDB no responde.

### `POST /api/auth/logout` (requiere sesión)
`204` sin cuerpo. Borra la cookie y agrega el `jti` a la lista de tokens revocados hasta que venza. Después de esto el mismo token debe responder `401`. `401` si no hay sesión válida.

Se revoca el token con el que se hizo la petición. La cookie se borra siempre que la respuesta sea `204`.

> **Limitación conocida:** la lista de revocados vive en la memoria del proceso. Si la API se reinicia, un token ya cerrado vuelve a servir hasta que venza (60 min como máximo). Por eso se usa un solo proceso de Uvicorn (sin `--workers`).

---

## Fase 4 · API REST

### Interacciones (Couchbase Capella) · definido en v0.10

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

Detalle v0.10:
- Cuerpo de `POST` y `PUT`: `id_usuario`, `timestamp` (`AAAA-MM-DDTHH:MM:SSZ`), `canal`, `tipo`, `tema`, `dispositivo`, `texto` (según el tipo, hasta 2000 caracteres), `sentimiento`, `idioma`, `reacciones_recibidas`, `etiquetas` (hasta 10; por omisión `[]`). En `POST` también `id_interaccion`. **Cualquier otro campo da `422`**: los de ubicación y también `longitud_texto`, que pone el servidor.
- `PUT` reemplaza la interacción completa; el id va solo en la ruta.
- `201` y `200` devuelven la interacción como en la lista (`texto` y `longitud_texto` son `null` si no hay texto). `404` → `{"detail": "Interacción no encontrada"}`. `409` → `{"detail": "Ya existe una interacción con ese id"}`.
- Los `422` de las validaciones contra TiDB usan el formato de FastAPI: `{"detail": [{"type": "valor_invalido", "loc": ["body", "<campo>"], "msg": "..."}]}`.
- `DELETE` es **borrado físico**. La lista va de la más reciente a la más antigua; `desde` y `hasta` usan el mismo formato que `timestamp`.
- Las métricas ven cada cambio en la siguiente petición. `503` si falta Capella (o TiDB para validar).

### Consultas históricas (TiDB + Capella)

| Ruta | Devuelve |
|---|---|
| `GET /api/usuarios` | Padrón paginado. **Definido en v0.6**: ver abajo |
| `GET /api/usuarios/{id_usuario}` | Un usuario. **Definido en v0.6**: ver abajo |
| `GET /api/catalogos` | Los 8 catálogos de TiDB. **Definido en v0.5**: ver abajo |
| `GET /api/metricas/resumen` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/estatus` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/plataformas` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/temas` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/actividad` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/geografia` | **Definido en v0.8**: ver abajo |
| `GET /api/metricas/puntos-calientes` | **Definido en v0.12**: ver abajo |
| `GET /api/metricas/tipos` | **Definido en v0.14**: ver abajo |
| `GET /api/metricas/etiquetas` | **Definido en v0.14**: ver abajo |
| `GET /api/cuarentena` | **Definido en v0.9**: ver abajo |

### `GET /api/catalogos` (requiere sesión, ambos roles) · v0.5

Devuelve los 8 catálogos de TiDB en una sola respuesta. No recibe parámetros.

- `200` → un objeto con las 8 llaves, siempre presentes (un catálogo sin filas llega como `[]`):

```json
{
  "rango_edad":       [ { "codigo": "18_24", "descripcion": "18-24", "activo": true } ],
  "especie":          [ { "codigo": "ave", "nombre": "Ave", "activo": true } ],
  "interes":          [ { "codigo": "arte_digital", "nombre": "Arte digital", "activo": true } ],
  "plataforma":       [ { "codigo": "discord", "nombre": "Discord", "activo": true } ],
  "tema":             [ { "codigo": "arte_comisiones", "nombre": "Arte y comisiones", "activo": true } ],
  "etiqueta":         [ { "codigo": "arte", "nombre": "Arte", "activo": true } ],
  "tipo_interaccion": [ { "codigo": "comentario", "nombre": "Comentario", "admite_texto": true, "activo": true } ],
  "dispositivo":      [ { "codigo": "android", "nombre": "Android", "activo": true } ]
}
```

- `401` sin sesión válida. `503` → `{"detail": "Base de datos no disponible"}` si TiDB no responde.

Reglas:

- Los campos se llaman igual que las columnas de TiDB. Por eso `rango_edad` trae `descripcion` en lugar de `nombre`, y solo `tipo_interaccion` trae `admite_texto`.
- `codigo` es la llave que usan `usuario` (`cod_*`) y los documentos de Capella (`canal`, `tipo`, `tema`, `dispositivo`, `etiquetas`). Con él se busca el nombre legible.
- **Se incluyen los códigos inactivos** con `activo: false`, para poder mostrar el nombre de datos que ya los usan. El dashboard **no** los ofrece como opción en los filtros. Al crear o editar interacciones (F4-01) solo se aceptan códigos activos.
- Cada lista viene ordenada por `codigo`. En `rango_edad` ese orden va de menor a mayor edad.
- **No incluye geografía** (`pais`, `estado`, `ciudad`). La ubicación solo aparece donde el contrato lo dice y siempre con consentimiento (`GET /api/usuarios` y `GET /api/metricas/geografia`).
- `analista` y `admin` la pueden consultar. Los catálogos no cambian desde la API: se leen en cada petición, sin caché.

### `GET /api/usuarios` (requiere sesión, ambos roles) · v0.6

Padrón de TiDB, paginado como dice [Paginación](#paginación-todas-las-listas) y ordenado por `id_usuario`.

Filtros opcionales, combinables (se cumplen todos a la vez):

| Parámetro | Valores | Si no es válido |
|---|---|---|
| `estatus` | `activo`, `en_riesgo`, `inactivo` | `422` |
| `plataforma` | `codigo` de `plataforma` | `422` si no tiene formato de código (`^[a-z0-9_]+$`, hasta 30 caracteres) |
| `especie` | `codigo` de `especie` | igual |
| `interes` | `codigo` de `interes` | igual |

Un código con formato válido que no existe da `200` con `total: 0`. Los códigos inactivos se aceptan como filtro. Un parámetro que no está en la tabla se ignora.

`200`:
```json
{
  "total": 1068, "pagina": 1, "limite": 50,
  "datos": [
    {
      "id_usuario": "U000001", "alias": "...", "fecha_ingreso": "2022-01-01",
      "cod_rango_edad": "25_31", "cod_especie": "lobo", "cod_interes": "arte_digital", "cod_plataforma": "discord",
      "es_artista": true, "mensajes_30d": 12, "reacciones_30d": 40, "eventos_asistidos": 1, "comisiones_compradas": 0,
      "sentimiento_promedio": 0.412, "ultima_actividad": "2026-11-08", "estatus": "activo",
      "consentimiento_datos": true, "es_atipico": false,
      "ubicacion": { "pais": "México", "estado": "Yucatán", "ciudad": "Mérida", "zona_horaria": "America/Merida" }
    },
    { "id_usuario": "U000002", "...": "...", "consentimiento_datos": false, "ubicacion": null }
  ]
}
```

- Los campos se llaman como las columnas de TiDB. Los `cod_*` se traducen a nombre con `GET /api/catalogos`.
- `fecha_ingreso` y `ultima_actividad` son fechas sin hora (`AAAA-MM-DD`). `sentimiento_promedio` es número entre -1 y 1, o `null`.
- `ubicacion` es `null` si `consentimiento_datos` es `false` (ver [Privacidad](#privacidad-todas-las-rutas)). Nunca trae `latitud` ni `longitud`.
- No se devuelven `creado_en` ni `actualizado_en` (control interno del ETL).
- `401` sin sesión, `422` por un parámetro inválido, `503` si TiDB no responde.

### `GET /api/usuarios/{id_usuario}` (requiere sesión, ambos roles) · v0.6

- `200` → el mismo objeto que cada elemento de `datos` en la lista, con las mismas reglas de ubicación.
- `404` → `{"detail": "Usuario no encontrado"}`.
- `422` → `id_usuario` no tiene el formato `U` + 6 a 9 dígitos (por ejemplo `U000001`).
- `401` sin sesión, `503` si TiDB no responde.

### `GET /api/metricas/*` (requiere sesión, ambos roles) · v0.8

Fórmulas en `docs/INDICADORES.md`. Sin parámetros. `401` sin sesión; `503` → `{"detail": "Base de datos no disponible"}` si falta TiDB o Capella (el mismo mensaje para las dos).

| Ruta | `200` |
|---|---|
| `resumen` | `{"usuarios", "usuarios_activos", "porcentaje_activos", "usuarios_con_consentimiento", "interacciones", "usuarios_que_interactuan", "sentimiento_promedio", "en_cuarentena", "generado_en"}` |
| `estatus` | `{"total", "datos": [{"estatus", "usuarios", "porcentaje"}]}`, siempre `activo`, `en_riesgo`, `inactivo` en ese orden |
| `plataformas` | `{"datos": [{"plataforma", "usuarios", "interacciones"}]}`, una fila por código del catálogo, incluso con 0 |
| `temas` | `{"datos": [{"tema", "interacciones", "sentimiento_promedio"}]}`, una fila por código; `sentimiento_promedio` es `null` sin interacciones |
| `actividad` | `{"zona_horaria": "UTC", "datos": [{"dia_semana", "hora", "interacciones"}]}`, 168 celdas; `dia_semana` 1 = lunes … 7 = domingo |
| `geografia` | `{"minimo_por_grupo": 3, "usuarios_con_ubicacion", "estados": [{"pais", "estado", "usuarios"}], "ciudades": [{"pais", "estado", "ciudad", "usuarios"}]}` |

`plataforma` y `tema` son códigos: el nombre sale de `GET /api/catalogos`. Las listas de `geografia` van de mayor a menor número de usuarios.

**Privacidad en `geografia`:** solo cuenta usuarios con `consentimiento_datos = TRUE`; **no devuelve ningún estado ni ciudad con menos de 3 usuarios**; nunca trae coordenadas ni `id_usuario`.

### `GET /api/metricas/puntos-calientes` (requiere sesión, ambos roles) · v0.12

Mapa de calor geográfico de usuarios con consentimiento (TiDB). Sin parámetros.

```json
{
  "tamano_cuadro": 0.2, "minimo_por_cuadro": 3,
  "usuarios_con_coordenadas": 793, "usuarios_en_mapa": 780,
  "datos": [ { "latitud_centro": 20.9, "longitud_centro": -89.7, "usuarios": 41 } ]
}
```

- Cada cuadro va de `k × 0.2` a `(k + 1) × 0.2` grados en latitud y en longitud; se devuelve solo su centro (`k × 0.2 + 0.1`), con 1 decimal.
- **Privacidad:** solo usuarios con `consentimiento_datos = TRUE` y coordenadas en `ubicacion_usuario`. Ningún cuadro con menos de 3 usuarios. Nunca coordenadas de un usuario ni `id_usuario`.
- `usuarios_con_coordenadas` cuenta también a los de cuadros ocultos; `usuarios_en_mapa`, solo a los visibles. `datos` va de mayor a menor número de usuarios.
- `401` sin sesión, `503` si TiDB no responde.

### `GET /api/metricas/tipos` y `GET /api/metricas/etiquetas` (requiere sesión, ambos roles) · v0.14

Conteos de Capella con el nombre legible del catálogo de TiDB (`tipo_interaccion`, `etiqueta`). Sin parámetros.

```json
{ "total": 203, "datos": [ { "tipo": "comentario", "nombre": "Comentario", "interacciones": 56, "porcentaje": 27.6 } ] }
{ "limite": 10, "datos": [ { "etiqueta": "evento", "nombre": "Evento", "interacciones": 53 } ] }
```

- `tipos`: una fila por código del catálogo, incluso con 0, ordenada por `tipo`. `total` = todas las interacciones; `porcentaje` a 1 decimal.
- `etiquetas`: las 10 más usadas (o menos, si no hay 10 en uso), de más a menos; empate por código. `interacciones` = interacciones que llevan la etiqueta. No incluye etiquetas sin uso.
- `nombre` es `null` si un documento usa un código que no está en el catálogo (no debería pasar: el ETL y el CRUD los validan).
- `401` sin sesión, `503` si falta TiDB o Capella.

### `GET /api/cuarentena` (requiere sesión, ambos roles) · v0.9

Registros que el ETL rechazó (colección `cuarentena` de Capella). Solo lectura, paginado como dice [Paginación](#paginación-todas-las-listas), del más reciente al más antiguo (`detectado_en`, luego `id_cuarentena`).

Filtro opcional `motivo`: `duplicado`, `tipo_dato_invalido`, `categoria_invalida`, `usuario_inexistente` o `fecha_anterior_ingreso`. Otro valor → `422`.

```json
{ "total": 797, "pagina": 1, "limite": 50, "datos": [ {
  "id_cuarentena": "q_0a1b2c3d4e5f6a7b", "tipo_registro": "interaccion",
  "motivos": ["usuario_inexistente"], "detectado_en": "2026-11-20T10:00:00Z",
  "fuente": "csv", "id_lote": "...", "estado_revision": "pendiente", "id_original": "I0001825",
  "registro": { "id_interaccion": "I0001825", "id_usuario": "U009999", "...": "campos originales" }
} ] }
```

- `registro` trae los campos originales tal como llegaron, **sin** `pais`, `estado`, `ciudad`, `zona_horaria`, `latitud` ni `longitud`: la API los quita aunque estuvieran en el documento.
- `tipo_registro` es `interaccion` (el ETL solo manda interacciones a cuarentena).
- `401` sin sesión, `422` por un parámetro inválido, `503` si Capella no responde.

---

## Fase 5 · WebSocket · v0.11, bidireccional desde v0.13

Ruta: `ws://localhost:5173/ws/metricas` en el dashboard (proxy de Vite) o `ws://localhost:8000/ws/metricas` directo.

- **Sesión:** la misma de las rutas HTTP, la cookie `c360_token` o el encabezado `Authorization: Bearer` (Postman). No se acepta el token en la URL. Sin sesión válida, el servidor cierra con `4401`. Ambos roles.
- **Origen:** si el cliente manda `Origin` (un navegador siempre lo hace), debe ser `http://localhost:5173`; si no, cierra con `4403`.
- **Al conectarse** el servidor manda el resumen. **Después de cada `POST`, `PUT` o `DELETE` exitoso** de interacciones, lo vuelve a mandar a todos los conectados, en el mismo orden de los cambios. También lo manda **cuando el cliente lo pide** (`{"accion": "actualizar"}`), solo a ese cliente. No consulta las bases por su cuenta: sin cambios ni pedidos no hay mensajes.
- Si la sesión vence o se cierra con logout, la conexión se cierra con `4401` en el siguiente envío.

Mensajes del servidor:
```json
{ "evento": "metricas.actualizadas",  "cambio": { "tipo": "creada", "id_interaccion": "I0000204" }, "datos": { "...": "mismo formato que GET /api/metricas/resumen" }, "ts": "2026-11-25T20:15:00Z" }
{ "evento": "metricas.no_disponibles", "cambio": null, "datos": { "detail": "Base de datos no disponible" }, "ts": "..." }
{ "evento": "error", "datos": { "detail": "Mensaje no reconocido" }, "ts": "..." }
{ "evento": "pong" }
```
- `cambio` (v0.13) dice qué provocó el mensaje: `tipo` es `creada`, `editada` o `borrada`, con el `id_interaccion`. Es `null` en el resumen inicial y en la respuesta a `actualizar`. `metricas.no_disponibles` también lo trae.
- `metricas.no_disponibles` llega si TiDB o Capella no responden al calcular el resumen; la conexión sigue abierta.

Mensajes del cliente (exactamente estos objetos JSON):

| Mensaje | Respuesta |
|---|---|
| `{"accion": "actualizar"}` | `metricas.actualizadas` con `cambio: null` (o `metricas.no_disponibles`) |
| `{"tipo": "ping"}` | `{"evento": "pong"}` |
| cualquier otro, texto que no es JSON o JSON que no es objeto | `evento: error` con `detail` `Mensaje no reconocido` o `El mensaje debe ser un objeto JSON`. **La conexión sigue abierta.** |

Toda respuesta revisa antes la sesión: si venció o se cerró con logout, cierra con `4401`.

Los eventos separados por interacción (`interaccion.creada`, etc.) de la propuesta anterior no se implementan: el tipo de cambio viaja en `cambio`. Para refrescar otras gráficas, el dashboard puede volver a pedir `GET /api/metricas/*` al recibir `metricas.actualizadas`.
