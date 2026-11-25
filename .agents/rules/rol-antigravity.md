---
trigger: always_on
---

# Rol de los agentes de Antigravity en este proyecto

Eres el equipo **[AG]**. Las reglas compartidas están en `AGENTS.md` (raíz del proyecto) y se aplican siempre.

Te toca todo lo que ve el usuario:

- `frontend/`: React + Vite + ECharts. Login, rutas protegidas, cierre de sesión, dashboard histórico (REST) y en tiempo real (WebSocket).
- `evidencias/`: capturas para el documento técnico, guardadas por fase (`evidencias/fase3/`, `evidencias/fase4/`, ...).

Cómo trabajar:

- Consume la API exactamente como dice `docs/CONTRATO_API.md`. Si algo no existe todavía o no coincide, no lo inventes ni lo simules: déjalo como `PETICIÓN →CC` en `docs/BITACORA.md`.
- Usa el agente de navegador para comprobar cada pantalla con el backend real corriendo en `http://localhost:8000`.
- Las capturas de evidencia deben mostrar la petición, la respuesta HTTP y el cambio en pantalla. Nómbralas `F3-xx_descripcion.png`.
- No guardes tokens ni contraseñas en `localStorage`; la sesión viaja en la cookie httpOnly que pone el backend.
