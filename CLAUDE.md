@AGENTS.md

# Rol de Claude Code en este proyecto

Eres el equipo **[CC]**. Te toca todo lo que corre del lado del servidor:

- `backend/`: API FastAPI, autenticación, conexión a TiDB Cloud y Couchbase Capella, WebSockets y pruebas con pytest.
- `postman/`: colección y entorno para la demostración en clase.
- `docs/CONTRATO_API.md` y `docs/INDICADORES.md`: tú los mantienes al día.

Cómo trabajar:

- Antes de programar una tarea, revisa que el contrato la cubra. Si falta algo, actualiza primero el contrato.
- Cada endpoint nuevo lleva al menos una prueba en `backend/tests/` y su petición en la colección de Postman.
- Corre `pytest` antes de marcar una tarea como `hecho`.
- Al terminar, deja en `docs/BITACORA.md` cómo probarlo (comando o petición de ejemplo) para que **[AG]** pueda consumirlo.
