# postman · [CC] Claude Code

Colección y entorno para la demostración. Las altas, cambios y bajas de interacciones se hacen solo desde aquí.
El entorno usa variables (`base_url`, `correo`, `password`, `token`); las contraseñas reales no se guardan en el archivo exportado.

## Antes de probar

- **Elegir "No environment"** (arriba a la derecha). Las variables de un entorno tienen prioridad sobre las de la colección: si el entorno activo es de otro proyecto y tiene su propia `token`, `correo`, `password` o `base_url`, la pisa y Me o Logout responden `401` aunque el Login haya dado `200`. Pasó con un entorno ajeno que tenía otra `token`. El entorno propio del proyecto llega en F3-05.
- Escribir `correo` y `password` en la pestaña Variables de la colección, solo en el valor local (*Current value*). No exportar la colección encima del archivo del proyecto.
- Orden: Login → Me (`200`) → Logout (`204`) → Me (`401`). No reiniciar la API entre Logout y Me: los tokens revocados viven en memoria.
