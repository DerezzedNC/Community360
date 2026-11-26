# postman · [CC] Claude Code

Colección y entorno para la demostración. Las altas, cambios y bajas de interacciones se hacen solo desde aquí.

| Archivo | Contenido |
|---|---|
| `community360.postman_collection.json` | Colección **COMMUNITY 360** |
| `community360.postman_environment.json` | Entorno **COMMUNITY 360**, con contraseñas y token vacíos |

## Preparar

1. En Postman, borrar la colección COMMUNITY 360 anterior, si existe.
2. **Import** → elegir los dos archivos `.json` de esta carpeta.
3. Arriba a la derecha, elegir el entorno **COMMUNITY 360**. Con otro entorno las peticiones no se envían: aparece en *Test Results* el aviso "Elige el entorno COMMUNITY 360".
4. Abrir el entorno y llenar, **solo en el valor local** (*Current value*; no el compartido ni *Initial value*):
   `c360_correo_admin`, `c360_password_admin`, `c360_correo_analista`, `c360_password_analista`. Guardar.
5. Dejar `c360_token` vacía: la llenan los Login. Vale el último inicio de sesión.

No exportar la colección ni el entorno encima de los archivos del proyecto: podrían llevar contraseñas o el token.

Todas las variables empiezan con `c360_` para no chocar con las de otros proyectos. Las variables de un entorno tienen prioridad sobre las de la colección; antes pasó que un entorno ajeno tenía su propia `token` y la pisaba.

## Usar

Con la API levantada (`backend/README.md`), enviar en orden o con *Run collection*. Cada petición exige su código exacto; solo Health acepta dos.

| Petición | Esperado |
|---|---|
| 1. Health | `200` (o `503` si falta una base) |
| 2. Login fallido | `401` `Correo o contraseña incorrectos` |
| 3. Sin token | `401` `Sesión no válida o vencida` |
| 4. Login admin | `200` |
| 5. Me (admin) | `200` |
| 6. Logout (admin) | `204` |
| 7. Token revocado | `401` `Sesión no válida o vencida` |
| 8. Login analista | `200` |
| 9. Me (analista) | `200` |
| 10. Logout (analista) | `204` |
| **Fase 4 · Consultas** | |
| 11. Login analista | `200` |
| 12. Catálogos | `200` con los 8 catálogos |
| 13. Usuarios (página 1) | `200`, 50 usuarios |
| 14. Usuarios filtrados | `200`, solo `en_riesgo` de `discord` |
| 15. Usuario sin consentimiento | `200` con `ubicacion: null` |
| 16. Límite fuera de rango | `422` |
| 17 a 22. Métricas | `200` (resumen, estatus, plataformas, temas, actividad, geografía) |
| 23. Cuarentena | `200` |
| 24. Logout (analista) | `204` |

- **3 y 7 llevan las cookies desactivadas** (Settings de la petición). Postman guarda la cookie del login y la reenvía sola; con ella, "Sin token" daría `200`.
- **7 necesita 4 y 6 antes**, con la API sin reiniciar: los tokens revocados viven en memoria. Comprueba que el token no haya vencido, para demostrar que el `401` es por el logout.
- **La carpeta Fase 4 abre su propia sesión** (11) porque el token de la Fase 3 queda revocado en 10. Las consultas usan la cuenta analista: son de solo lectura.
- **12. Catálogos** revisa que lleguen las 8 listas, sin país, estado ni ciudad, con los campos del contrato v0.5 y ordenadas por código. Los códigos inactivos aparecen con `activo: false`.
- **13 y 14** revisan en cada usuario que, sin consentimiento, `ubicacion` sea `null`, y que la respuesta nunca traiga `latitud` ni `longitud`.
- **15 necesita 13 antes**: toma de esa página el `id_usuario` de alguien sin consentimiento. Sirve para mostrar la regla de privacidad en la demostración.
- **16** pide `limite=201`: la API responde `422` en lugar de recortarlo en silencio.

## Evidencias (F3-09)

Capturar la petición, el código y el cuerpo de **2, 3 y 7**; en 5 y 6, también.

No capturar:

- La respuesta de Login (4 y 8) sin tapar `token`.
- La consola de Postman: muestra contraseñas y tokens.
- La pestaña del entorno con valores visibles, ni el encabezado `Authorization` con el token visible.
- La pestaña Cookies, porque trae `c360_token`.
