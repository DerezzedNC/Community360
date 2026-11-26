# Bitácora de agentes

Agrega las entradas al final, la más reciente abajo. Formato:

```
## AAAA-MM-DD · [CC|AG] · ID de tarea
- Qué cambió:
- Cómo se prueba:
- PETICIÓN →CC / →AG (si aplica):
```

---

## 2026-11-24 · Angel · Arranque
- Qué cambió: se creó la carpeta del proyecto con reglas compartidas (`AGENTS.md`), rol de Claude Code (`CLAUDE.md`), rol de Antigravity (`.agents/rules/`), plan, tablero de tareas y contrato de la API v0.1.
- Cómo se prueba: no aplica.
- Pendiente: confirmar con el profesor la lista mínima de endpoints de la Fase 4 y las condiciones de la Fase 5 (no vienen en el PDF).

## 2026-11-24 · [CC] · F3-01 (avance, sigue en curso)
- Qué cambió: base del backend (`backend/app`, `requirements.txt`, pruebas), `GET /api/health` y petición "Health" en `postman/`. **Contrato v0.2**: `GET /api/health` responde `503` con `{"estado": "degradado", "tidb": ..., "capella": ...}` si falta alguna base.
- Cómo se prueba: ver `backend/README.md`. Con la API levantada en el puerto 8000: `curl.exe -i http://localhost:8000/api/health`.
- Estado: 13 pruebas sin red pasan y TiDB conecta. La prueba con conexión real (marca `nube`) **falla**: el DNS no encuentra el nodo de Capella (NXDOMAIN); probablemente el cluster está apagado. Falta que Angel lo encienda para comprobar el `200`.
- PETICIÓN →AG: el indicador de conexión debe mostrar "degradado" cuando `GET /api/health` responda `503`. Ese `503` trae el objeto de estado (no `{"detail": ...}`); `tidb` y `capella` dicen cuál base falta.


## 2026-11-24 · [AG] · F3-06
- Qué cambió: se creó la base de `frontend/` con React + Vite, `react-router-dom` y `echarts` instalado; proxy en `vite.config.js` para `/api` y `/ws` (`ws: true`) hacia `http://localhost:8000` en el puerto `5173`; cliente HTTP base con `credentials: "include"` sin `localStorage`; layout vacío responsivo de solo lectura e indicador de `GET /api/health` que soporta `200` (`ok`), `503` (`degradado` detallando `tidb` y `capella`, atendiendo la `PETICIÓN →AG` del contrato v0.2) y falta de red (`sin conexión`).
- Cómo se prueba: en `frontend/` ejecutar `npm run dev` y abrir `http://localhost:5173` (redirige a `/dashboard`).
- PETICIÓN →CC / →AG (si aplica): atendida la `PETICIÓN →AG` de F3-01 sobre el `503` `"degradado"`. Quedamos atentos al cierre de F3-03 para iniciar F3-07.

## 2026-11-24 · [CC] · F3-01 (cierre, con verificación pendiente)
- Qué cambió: F3-01 pasa a `hecho` por decisión de Angel, con la nota "pendiente verificar health 200 con Capella real". Se creó VER-01 (bloqueada) en `docs/TAREAS.md` con la lista de lo que falta probar.
- Estado: las 13 pruebas sin red pasan (`pytest -m "not nube"`) y TiDB conecta de verdad. **La prueba `nube` sigue fallando**: el DNS de Capella ya resuelve, pero los puertos 11207 y 18091 no contestan desde la red actual, así que `GET /api/health` todavía no ha dado `200` con las bases reales.
- Forma de trabajo: hasta resolver VER-01, lo que toque Capella se prueba simulándola en `backend/tests/`, y lo que falte probar con la base real se agrega a VER-01.
- Cómo se prueba: ver `backend/README.md`. Con la API en el puerto 8000: `curl.exe -i http://localhost:8000/api/health` → por ahora `503` con `{"estado":"degradado","tidb":true,"capella":false}`.
- Aviso →AG: no hay que cambiar nada (el contrato sigue en v0.2). Por ahora `GET /api/health` dará `503` "degradado" con `capella: false`; es lo esperado. El login (F3-03) usa solo TiDB, así que F3-07 y F3-08 no dependen de Capella. No pongan datos de ejemplo en el dashboard para suplir a Capella.

## 2026-11-24 · [CC] · F3-02
- Qué cambió: `backend/app/seguridad.py` (hash Argon2id y formato del correo), `backend/app/repositorios/usuario_admin.py` (buscar e insertar) y `backend/scripts/crear_admin.py` (alta por consola, contraseña oculta de 12 caracteres como mínimo). Angel creó las dos cuentas: `id_admin` 1 (`admin`) y 2 (`analista`).
- Estado: comprobado en TiDB en solo lectura: 2 cuentas activas, hash Argon2id, correos y hashes distintos. 43 pruebas pasan (`pytest` completo).
- Cómo se prueba: `.venv\Scripts\python -m pytest tests/test_seguridad.py tests/test_crear_admin.py`. Para otra cuenta: `.venv\Scripts\python -m scripts.crear_admin` en una ventana de PowerShell, desde `backend/`.
- Aviso →AG: no hay que cambiar nada. Los correos de las cuentas van en minúsculas y sin acentos ni ñ. Las credenciales las tiene Angel; no se escriben en el código ni en las evidencias.

## 2026-11-24 · [CC] · VER-01
- Qué cambió: Capella ya responde. Angel autorizó su IP actual en Allowed IP Addresses. VER-01 y la nota de F3-01 quedan resueltas; las pruebas con Capella simulada siguen como pruebas rápidas.
- Cómo se probó (solo lectura): `GET /api/health` → `200` con las dos bases; `pytest -m nube` pasa; `interacciones` 203 y `cuarentena` 797 documentos; la API levantada sin Capella pasó de `503` a `200` sin reiniciar, unos 2 min después de volver la conexión.
- Observación: en una de las consultas a `health`, TiDB no respondió a tiempo (16 s, `503` con `tidb: false`). No se repitió en 25 conexiones seguidas (mediana 1.4 s, máximo 3.3 s). Causa sin confirmar.
- Para la demostración: si cambia la red, hay que autorizar la IP nueva en Capella, y levantar la API después de que el cluster esté HEALTHY.
- Aviso →AG: `GET /api/health` ya puede dar `200` "ok". El indicador debe seguir soportando el `503`.

## 2026-11-25 · [CC] · F3-03
- Qué cambió: `POST /api/auth/login`, `GET /api/auth/me` y `POST /api/auth/logout` (`backend/app/routers/auth.py`, `tokens.py`, `dependencias.py`) y las peticiones Login, Me y Logout en `postman/`. **Contrato v0.3**: si llegan `Bearer` y cookie gana el `Bearer`; `503` `{"detail": "Base de datos no disponible"}` si TiDB falla; el `422` solo trae `type`, `loc` y `msg`; contraseña de 1 a 1024 caracteres; `me` da `401` si la cuenta fue desactivada.
- Limitación: los tokens revocados viven en memoria. Si la API se reinicia, un token cerrado vuelve a servir hasta que venza (60 min como máximo). Usar un solo proceso de Uvicorn.
- Estado: 89 pruebas sin red pasan. Con TiDB real se probó, sin escribir: login con correo inexistente (`401`), `422` y `401` sin token. **Falta** el login correcto con una cuenta real, que hace Angel desde Postman. La prueba `nube` falla hoy porque la IP de salida de Angel cambió y Capella no contesta desde la nueva; F3-03 no usa Capella.
- Cómo se prueba: levantar la API (`backend/README.md`). Sin credenciales: `curl.exe -i http://localhost:8000/api/auth/me` → `401`. Con cuenta: en Postman, Login → Me (`200`) → Logout (`204`) → Me (`401`).
- **Aviso →AG: ya pueden tomar F3-07.** Usar el contrato v0.3:
  - `POST /api/auth/login` con `{"correo", "password"}`. La sesión viaja en la cookie httpOnly `c360_token`: no guardar el `token` de la respuesta ni mandar `Authorization` desde el dashboard (si se manda, el `Bearer` gana a la cookie).
  - `401` → mostrar el `detail` tal cual. `503` → servicio no disponible, no es error de contraseña. `422` → `detail` es una **lista**, no un texto; con `peticionApi` actual sale "Error HTTP 422", así que la pantalla debe poner su propio mensaje (por ejemplo, revisar el formato del correo).
  - El login tarda unos 2 s con TiDB real: deshabilitar el botón mientras responde.
  - F3-08: `GET /api/auth/me` da `401` si no hay sesión; un `503` no significa sesión cerrada, así que no hay que mandar a `/login`.

## 2026-11-25 · [CC] · F3-03 (verificación con cuentas reales)
- Qué cambió: `postman/README.md` explica que hay que elegir "No environment" (un entorno ajeno con su propia `token` pisaba la de la colección). A petición de Angel, la cuenta `id_admin` 2 (analista, contraseña olvidada, sin accesos) quedó con `activo = FALSE`; no se borró. Las cuentas en uso son `id_admin` 1 (admin) y 30001 (analista).
- Estado: Angel probó en Postman con admin y con analista: Login `200`, Me `200`, Logout `204`, Me después de logout `401` y contraseña incorrecta `401`. Comprobado en TiDB en solo lectura: `ultimo_acceso` se actualizó en las dos cuentas. F3-03 queda verificada con cuentas reales.
- Cómo se prueba: ver `postman/README.md`.
- Aviso →AG: `id_admin` no es consecutivo (TiDB puede saltar números, por ejemplo 2 → 30001); no suponer un orden ni un tamaño.


## 2026-11-25 · [AG] · F3-07
- Qué cambió: pantalla de inicio de sesión en `frontend/src/paginas/PaginaLogin.jsx`, estilos en `global.css` y función `iniciarSesion` en `frontend/src/servicios/api.js` consumiendo `POST /api/auth/login` con `credentials: "include"`, sin encabezado `Authorization`, sin guardar `token` en cliente y sin `console.*`. Maneja `200` (redirige a `/dashboard`), `401` (muestra `detail` exacto), `422` (mensaje de formato en español) y `503`/caída de red (aviso diferenciado de servicio).
- Cómo se prueba: con la API en el puerto `8000` y `npm run dev` en `frontend/`, abrir `http://localhost:5173/login`, probar credenciales inválidas (`401`) y válidas (`200` → `/dashboard`). Verificado por Angel con la API real.
- PETICIÓN →CC / →AG (si aplica): ninguna.

## 2026-11-25 · [CC] · F3-04
- Qué cambió: dependencia `proteger` (`backend/app/dependencias.py`) aplicada a toda la app: todo `/api/*` pide sesión menos `GET /api/health` y `POST /api/auth/login`; `analista` solo lee y cierra su sesión. **Contrato v0.4**: cuerpo del `403`, orden `401` → `403` → `404`/`422` y la decisión de que las escrituras revisan en TiDB que la cuenta siga activa y sea `admin`, mientras que las lecturas confían en el token.
- Estado: `pytest` completo, 113 de 113 con la prueba `nube`. Capella volvió a responder al autorizar la IP actual: `GET /api/health` dio `200` con las dos bases. El `403` se probó con rutas que existen solo en las pruebas; en Postman se verá hasta F4-01, cuando haya endpoints de escritura.
- Cómo se prueba: `.venv\Scripts\python -m pytest tests/test_proteccion.py`. Con la API levantada y sin sesión: `curl.exe -i http://localhost:8000/api/auth/me` → `401`. **Hay que reiniciar la API** para que tome este cambio.
- Aviso →AG: no cambia nada para F3-08. El `401` es igual en cualquier ruta protegida (`{"detail": "Sesión no válida o vencida"}`): manden a `/login` ante ese `401` en cualquier petición, no solo en `me`. El `403` no es sesión cerrada: no hay que mandar a `/login`. Una ruta que no existe da `404` sin pedir sesión.


## 2026-11-25 · [AG] · F3-08
- Qué cambió: guardia `RutaProtegida.jsx` en `/dashboard` que consulta `GET /api/auth/me` (`cache: "no-store"`) en cada ingreso y al volver con el botón Atrás (`pageshow`), redirigiendo a `/login` ante `401` (tanto en `me` como en cualquier otra ruta protegida vía evento global, atendiendo el aviso de F3-04, sin expulsar en `403` ni `503`); redirección automática de `/login` → `/dashboard` si ya hay sesión activa; visualización de `nombre`, `correo` y `rol` en `LayoutDashboard.jsx` y botón "Cerrar sesión" conectado a `POST /api/auth/logout`.
- Cómo se prueba: con la API en `8000` y `npm run dev` en `5173`, probar acceso a `/dashboard` sin sesión (`→ /login`), inicio de sesión con `admin` y `analista`, visita a `/login` con sesión activa (`→ /dashboard`), "Cerrar sesión" (`204 → /login`) y botón Atrás del navegador. Verificado por Angel con la API real.
- PETICIÓN →CC / →AG (si aplica): atendido el aviso de F3-04 (Contrato v0.4). Quedamos atentos al cierre de F3-05 para iniciar F3-09.

## 2026-11-25 · [CC] · F3-05
- Qué cambió: entorno **COMMUNITY 360** (`postman/community360.postman_environment.json`, contraseñas y token vacíos), colección de 10 peticiones con su código exacto, `postman/README.md` y `backend/tests/test_postman.py`. Las variables pasan a llamarse `c360_*`; ya no se usa "No environment". Si el entorno activo no es COMMUNITY 360, la petición no se envía y lo avisa. El contrato sigue en v0.4.
- Estado: `pytest` completo, 120 de 120 con la prueba `nube`. Con Newman, la colección completa pasa contra una copia de la API con cuentas falsas en memoria, y las peticiones 1 y 3 contra la API real. **Falta** el recorrido completo con las cuentas reales, que hace Angel en Postman.
- Cómo se prueba: ver `postman/README.md` (importar, llenar variables y *Run collection*).
- Aviso →AG: **F3-09 ya tiene sus dependencias en `hecho`.** Para las evidencias de Postman usar "2. Login fallido", "3. Sin token" y "7. Token revocado". No capturar la respuesta de Login sin tapar `token`, la consola, la pestaña Cookies ni el entorno o el `Authorization` con valores visibles.

## 2026-11-25 · [CC] · F3-05 (verificada) y detalle de la Fase 4
- Qué cambió: Angel corrió la colección completa en Postman con el entorno COMMUNITY 360 y las cuentas reales: las 10 peticiones en verde (`200`, `401`, `401`, `200`, `200`, `204`, `401`, `200`, `200`, `204`). F3-05 queda verificada. F3-09 pasa a `pospuesta` por decisión de Angel. F4-02 y F4-03 se dividieron en tareas de solo lectura (F4-02a a F4-02f y F4-03a a F4-03e).
- Estado: con esto queda lista la parte programada de la Fase 3; solo faltan las capturas (F3-09).
- Cómo se prueba: no aplica (solo documentos).
- Datos revisados (solo lectura) para las tareas nuevas: 1068 usuarios, 897 con ubicación y 171 sin consentimiento y sin ubicación; 203 interacciones de 134 usuarios; 797 en cuarentena (`usuario_inexistente` 793, `fecha_anterior_ingreso` 4). En `interacciones` el id no es un campo del documento: es la llave (`META().id`).
- Aviso →AG: F3-09 está `pospuesta`, no la tomen. La primera tarea disponible será F4-03a, cuando F4-02a esté en `hecho`. Los filtros de las vistas son consultas `GET`, no formularios de captura.

## 2026-11-25 · [CC] · Repositorio en GitHub
- Qué cambió: el proyecto está en un repositorio privado de GitHub (`origin`, rama `main`). Antes de subirlo se reescribió el historial para quitar los CSV (`etl/datos/`) y los PDF (`docs/especificacion/`), y el `TIDB_HOST` de `etl/.env.example` pasó a un valor de ejemplo. Los archivos siguen en el disco de Angel, ignorados. El `.gitignore` se completó y `AGENTS.md` tiene la sección "Git y GitHub".
- Aviso →AG: los hashes de los commits anteriores cambiaron (su `[AG] F4-00 en curso` ahora es `2742b9b`). Al terminar cada tarea: commit, `git pull --rebase` y `git push` a `origin main`. No usar `git add -f` con archivos ignorados.

## 2026-11-25 · [CC] · F4-02a
- Qué cambió: `GET /api/catalogos` (`backend/app/routers/catalogos.py`, `backend/app/repositorios/catalogos.py`), `backend/tests/test_catalogos.py` y la carpeta **Fase 4 · Consultas** en `postman/` (11. Login analista, 12. Catálogos, 13. Logout). **Contrato v0.5**, aprobado por Angel: se incluyen los códigos inactivos con `activo: false` y no se incluye geografía (`pais`, `estado`, `ciudad`).
- Estado: `pytest` completo, 132 de 132, incluidas las 2 pruebas `nube`. La de catálogos lee la TiDB real (solo lectura): 8 catálogos con 56 códigos, todos activos por ahora. Los 8 se leen con una sola consulta (`UNION ALL`).
- Cómo se prueba: reiniciar la API (`backend/README.md`). Sin sesión: `curl.exe -i http://localhost:8000/api/catalogos` → `401`. Con sesión: en Postman, carpeta Fase 4 → 11, 12 y 13; o en el navegador, con sesión iniciada en el dashboard, abrir `http://localhost:5173/api/catalogos`.
- **Aviso →AG: ya pueden tomar F4-03a** (sus dependencias F3-08 y F4-02a están en `hecho`). Usar el contrato v0.5:
  - Una sola petición `GET /api/catalogos` al entrar al dashboard. Trae 8 llaves, siempre presentes; cada una es una lista ordenada por `codigo`.
  - `rango_edad` trae `descripcion`, no `nombre`. Solo `tipo_interaccion` trae `admite_texto`.
  - Para mostrar nombres legibles, buscar por `codigo` en **todas** las filas, también las de `activo: false`. Para las opciones de los filtros, **solo** las de `activo: true`.
  - No hay países, estados ni ciudades en esta ruta: no armar filtros geográficos con ella.
  - `401` → `/login`, como en cualquier ruta. `503` → aviso de servicio no disponible, sin datos de reemplazo.

## 2026-11-25 · [AG] · F4-00
- Qué cambió: estructura responsiva del dashboard en `frontend/src/paginas/PaginaDashboard.jsx` y `TarjetaSeccion.jsx` con las 8 secciones de solo lectura (`GET /api/metricas/resumen`, `/estatus`, `/plataformas`, `/temas`, `/geografia` con insignia de consentimiento, `/actividad`, `GET /api/usuarios` y `GET /api/cuarentena`), todas mostrando `"Pendiente de conexión con la API"` sin filtros aún y sin ningún dato o lista estática; navegación lateral por secciones en `LayoutDashboard.jsx`; componentes reutilizables ECharts (`GraficaBarras`, `GraficaDona`, `GraficaMapaCalor` sin asumir ejes, y `LienzoEcharts`) con manejo de estados `cargando`, `sin datos` y `error`.
- Cómo se prueba: con `npm run dev` en `frontend/` y sesión iniciada en `http://localhost:5173/dashboard`, verificar las 8 secciones, su diseño responsivo en escritorio y móvil, y `npm run build`.
- PETICIÓN →CC / →AG (si aplica): `PETICIÓN →CC`: conforme cierren `F4-02b` a `F4-02f`, documentar en `docs/CONTRATO_API.md` el formato JSON exacto de respuesta (llaves, tipos, paginación y estructura de ejes/celdas en `/api/metricas/actividad`) de `GET /api/usuarios`, `GET /api/usuarios/{id_usuario}`, `GET /api/metricas/*` y `GET /api/cuarentena` para consumirlos tal cual en `F4-03b`–`F4-03e`.

## 2026-11-25 · [CC] · F4-02b
- Qué cambió: `GET /api/usuarios` y `GET /api/usuarios/{id_usuario}` (`backend/app/routers/usuarios.py`, `backend/app/repositorios/usuarios.py`), `backend/tests/test_usuarios.py` y las peticiones 13 a 16 en la carpeta Fase 4 de `postman/` (el logout pasa a ser la 17). **Contrato v0.6**, aprobado por Angel:
  - Reglas generales de paginación: `pagina` desde 1 y `limite` de 1 a 200; fuera de rango da `422`, nunca se recorta en silencio.
  - Reglas generales de privacidad: sin consentimiento `ubicacion` es `null`, y la API **nunca** devuelve `latitud` ni `longitud`.
- Privacidad, en tres capas: (1) la ubicación se une con `LEFT JOIN ... AND u.consentimiento_datos = TRUE`, así que una fila sobrante en `ubicacion_usuario` no se lee; (2) en Python, `ubicacion` solo se arma si `consentimiento_datos` es verdadero; (3) pruebas con una fila sobrante simulada y una prueba `nube` que recorre los 1068 usuarios reales, solo con `GET`. Tampoco hay filtro ni orden por ubicación.
- Estado: `pytest` completo, 174 de 174 con las 3 pruebas `nube`. En una corrida la prueba `nube` de usuarios falló porque TiDB tardó más de 10 s en aceptar una conexión (`503`); en las 4 corridas siguientes pasó. Es la misma lentitud intermitente que se anotó en VER-01, no un error de la ruta: la consulta tarda 11 ms en TiDB y cerca de 1 s por petición con la conexión.
- Cómo se prueba: reiniciar la API. Sin sesión: `curl.exe -i http://localhost:8000/api/usuarios` → `401`. Con sesión: en Postman, carpeta Fase 4 → 11 a 17 (la 15 toma de la 13 a un usuario sin consentimiento y muestra `ubicacion: null`).
- **Aviso →AG: ya pueden conectar el padrón de usuarios (F4-03b)**, con el contrato v0.6:
  - `GET /api/usuarios?pagina=1&limite=50` → `{total, pagina, limite, datos}`, ordenado por `id_usuario`. Páginas: `Math.ceil(total / limite)`. No pidan `limite` mayor a 200: da `422`.
  - Filtros combinables: `estatus` (`activo`, `en_riesgo`, `inactivo`), `plataforma`, `especie`, `interes`, con el `codigo` del catálogo. Al cambiar un filtro, vuelvan a la página 1.
  - Los `cod_*` se traducen con `/api/catalogos`. `fecha_ingreso` y `ultima_actividad` son fechas sin hora; `sentimiento_promedio` puede ser `null`.
  - `ubicacion` es `{pais, estado, ciudad, zona_horaria}` o `null`. Si es `null`, mostrar algo como "Sin consentimiento" o "—", **nunca** buscar o deducir la ubicación por otro lado. No existen coordenadas.
  - Detalle: `GET /api/usuarios/{id_usuario}` → el mismo objeto; `404` → "Usuario no encontrado".
  - Con TiDB lenta, una petición puede tardar varios segundos o dar `503`: mostrar estado de carga y el aviso de servicio no disponible, sin datos de reemplazo.

## 2026-11-25 · [CC] · F4-04 Pool de conexiones a TiDB
- Qué hace: `backend/app/db/tidb.py` reutiliza hasta 4 conexiones, con ping antes de usarlas y renovación después de 4 min sin uso. Una conexión con error se descarta. Contrato v0.7: si las 4 siguen ocupadas después de 10 s, `503` igual que con TiDB caída. Con TiDB real, una conexión reutilizada tarda 0.3 s y una nueva de 0.5 a 5.5 s (con WARP).
- Cómo se prueba: `.venv\Scripts\python -m pytest tests/test_tidb_pool.py`. Hay que reiniciar la API.
- Aviso →AG: nada que cambiar; las peticiones del dashboard deberían responder más rápido.

## 2026-11-25 · [CC] · F4-02c, F4-02d y F4-02e Métricas
- Qué hace: `docs/INDICADORES.md` (fórmulas) y las 6 rutas `GET /api/metricas/*`: `resumen`, `estatus`, `plataformas`, `temas`, `actividad` y `geografia` (`backend/app/routers/metricas.py`, `backend/app/repositorios/metricas.py`). Contrato v0.8. Geografía solo cuenta usuarios con consentimiento, por estado y ciudad, oculta grupos de menos de 3 usuarios y nunca trae coordenadas. Si falta Capella, `503` con el mismo mensaje que TiDB.
- Estado: `pytest` sin nube, 196 de 196. Las consultas de TiDB se revisaron contra la base real (solo lectura). Las de Capella **no se han probado con la base real** (WARP activo): se hace en la prueba `nube` del cierre de fase.
- Cómo se prueba: reiniciar la API; Postman, carpeta Fase 4 → 17 a 22. Con WARP activo, `resumen`, `plataformas`, `temas` y `actividad` dan `503`; es lo esperado.
- Aviso →AG: ya pueden tomar F4-03c y F4-03d. `plataforma` y `tema` son códigos (nombre con `/api/catalogos`); `actividad` está en UTC con `dia_semana` 1 = lunes; en geografía no inventen ni completen los grupos ocultos.

## 2026-11-25 · [CC] · F4-02f Cuarentena
- Qué hace: `GET /api/cuarentena` (`backend/app/routers/cuarentena.py`): lista paginada de solo lectura, filtro `motivo`, con `tipo_registro`, `motivos`, `detectado_en` y el `registro` original. La API quita de `registro` cualquier campo geográfico o coordenada. Contrato v0.9.
- Estado: `pytest` sin nube, 204 de 204. La consulta a Capella **no se ha probado con la base real** (WARP activo); queda para la prueba `nube` del cierre.
- Cómo se prueba: reiniciar la API; Postman → 23. Cuarentena (`503` mientras WARP esté activo).
- Aviso →AG: ya pueden tomar F4-03e. `motivo` acepta solo los 5 valores del contrato; muestren `registro` tal cual llega, sin agregarle ubicación.


## 2026-11-25 · [AG] · F4-03a
- Qué cambió: conexión de `GET /api/catalogos` (Contrato v0.5) mediante `ContextoCatalogos.jsx` (una sola consulta al entrar al dashboard; traducción de nombres incluyendo `activo: false` y opciones de filtros estrictamente con `activo: true`, sin listas fijas ni geografía); rutas históricas protegidas `/dashboard/usuarios` y `/dashboard/cuarentena` dentro de `RutaProtegida`; selectores `plataforma`, `especie` e `interes` en `VistaUsuarios.jsx` sincronizados con `URLSearchParams` y manejo de error aislado en la zona de filtros con botón "Reintentar".
- Cómo se prueba: verificado por Angel en navegador (redirección sin sesión desde `/dashboard/usuarios` → `/login`, nombres de catálogos, persistencia en URL con `F5` y botón Atrás) y `npm run build`.
- PETICIÓN →CC / →AG (si aplica): ninguna (la petición de F4-00 quedó atendida por `[CC]` en el Contrato v0.9 e `INDICADORES.md`).


## 2026-11-25 · [AG] · F4-03b
- Qué cambió: vista histórica del padrón en `VistaUsuarios.jsx` conectada a `GET /api/usuarios` y `GET /api/usuarios/{id_usuario}` (Contrato v0.6), con paginación reutilizable en `PaginacionTabla.jsx` (`limite = 50`, reinicio a página 1 al cambiar cualquier filtro y sincronización con la URL), filtro de `estatus` (`activo`, `en_riesgo`, `inactivo`) combinado con `plataforma`, `especie` e `interes`, traducción de `cod_*` con `/api/catalogos`, modal de detalle (`404` → `"Usuario no encontrado"`) y cumplimiento estricto de privacidad (`ubicacion: null` muestra `"Sin consentimiento"`, sin deducir ni consultar otra fuente).
- Cómo se prueba: en `http://localhost:5173/dashboard/usuarios`, probar filtros combinados, cambio de página, F5/Atrás y botón `"Ver detalle"` tanto en un usuario con consentimiento como en uno sin consentimiento.
- PETICIÓN →CC / →AG (si aplica): ninguna.


## 2026-11-25 · [AG] · F4-03c
- Qué cambió: conexión de las métricas históricas de TiDB en `PaginaDashboard.jsx` mediante el hook `useConsultaApi.js`: `GET /api/metricas/estatus` en `GraficaDona` (con total y porcentajes reales) y `GET /api/metricas/geografia` en `GraficaBarras` horizontal con selector de solo lectura `Estados` / `Ciudades`, mostrando `usuarios_con_ubicacion` y `minimo_por_grupo` sin completar ni inferir los grupos ocultos por privacidad.
- Cómo se prueba: en `http://localhost:5173/dashboard`, verificar las tarjetas "Usuarios por estatus" y "Geografía" (conmutador Estados/Ciudades y reintento ante `503`).
- PETICIÓN →CC / →AG (si aplica): ninguna.
