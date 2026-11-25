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
