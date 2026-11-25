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
