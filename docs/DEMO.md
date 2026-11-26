# Guion de demostración · COMMUNITY 360

Diez pasos, unos 15 minutos. Los números de petición son los de la colección de Postman (`postman/README.md`).

**Nunca debe salir en una captura:** contraseñas, el `token` (respuesta de Login, encabezado `Authorization`, pestaña Cookies), la consola de Postman o del navegador, el entorno de Postman con valores visibles, `backend/.env` ni la consola de Capella o TiDB con la cadena de conexión, el usuario o la IP.

| # | Qué hacer | Captura | No debe salir |
|---|---|---|---|
| 1 | **Red y Capella.** Apagar Cloudflare WARP. En Capella: el cluster está *Healthy* y la IP actual está en *Allowed IP Addresses* (si cambió, agregarla). | Ninguna. | La IP, la cadena de conexión y los usuarios del cluster. |
| 2 | **API.** Cerrar cualquier API vieja en el puerto 8000. En `backend/`: `.venv\Scripts\python -m uvicorn app.main:create_app --factory --port 8000`. Luego `curl.exe -i http://localhost:8000/api/health`. | Respuesta de `health`: `200` con `tidb` y `capella` en `true`. | La terminal con el contenido de `.env` o con trazas que muestren el servidor. |
| 3 | **Frontend.** En `frontend/`: `npm run dev` y abrir `http://localhost:5173` (redirige a `/login`). | Pantalla de login vacía. | Las herramientas de desarrollador abiertas. |
| 4 | **Login admin** en el dashboard. | Dashboard con nombre y rol `admin`. | La contraseña escrita (capturar después de entrar) y la pestaña de cookies. |
| 5 | **Sesión en Postman.** Importar colección y entorno, elegir **COMMUNITY 360** y llenar las cuentas en el valor local. Enviar 2 (login fallido, `401`), 3 (sin token, `401`), 4 a 7 (login admin, me, logout, token revocado `401`) y 8 a 10 (analista). | Código y cuerpo de 2, 3, 7 y 9 (rol `analista`). | La respuesta de 4 y 8 (trae el `token`), el entorno y la pestaña *Authorization*. |
| 6 | **Consultas de la Fase 4.** Enviar 11 a 14 y 17 a 23. En el dashboard, abrir las vistas de usuarios, métricas y cuarentena. | Cuerpo de 12 (catálogos), 17 (resumen), 21 (mapa de calor) y 23 (cuarentena); gráficas del dashboard. | El encabezado `Authorization`. |
| 7 | **Privacidad.** Enviar 15 (usuario sin consentimiento) y 22 (geografía). | 15 con `consentimiento_datos: false` y `ubicacion: null`; 22 sin grupos de menos de 3 y sin coordenadas. | Nada adicional; no buscar la ubicación de ese usuario por otra vía. |
| 8 | **CRUD (admin).** Enviar 25 (login admin), 26 (crea su propia interacción, `201`), 28 (la lee), 29 (la edita, `200`) y 30 (la borra, `204`). Nunca se edita ni se borra una interacción del ETL. | Cuerpo de 26, 29 y el `204` de 30. | La respuesta de 25 (trae el `token`) y el entorno (`c360_id_interaccion` y demás valores). |
| 9 | **WebSocket.** En Postman: *New → WebSocket*, `ws://localhost:8000/ws/metricas`, *Headers* `Authorization: Bearer {{c360_token}}`, *Connect*. Con la conexión abierta, repetir 26 y luego 30. | Panel de mensajes: el resumen inicial y los dos `metricas.actualizadas`, con `interacciones` +1 y luego igual que al inicio. Si el dashboard ya usa el WebSocket (F5-02), la tarjeta cambiando sin recargar. | La pestaña *Headers* con el token resuelto. |
| 10 | **Cierre.** Enviar 31 (logout admin) y cerrar sesión en el dashboard: vuelve a `/login`. | Dashboard en `/login` después de cerrar sesión. | Nada adicional. |

Si un paso falla con `503`: revisar el paso 1 (IP de Capella) y que TiDB responda en `health`. Una consulta a TiDB puede tardar unos segundos la primera vez; las siguientes reutilizan la conexión.
