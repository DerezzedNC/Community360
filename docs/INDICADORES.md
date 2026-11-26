# Indicadores · COMMUNITY 360

Lo mantiene **[CC]**. Define cada dato de `/api/metricas/*`. Todo se calcula en cada petición con los datos actuales de TiDB (`usuario`, `ubicacion_usuario`, catálogos) y Capella (`interacciones`, `cuarentena`). Nada se guarda ni se inventa.

Redondeo: porcentajes a 1 decimal; sentimiento a 3 decimales. Un promedio sin datos es `null`.

## `GET /api/metricas/resumen` (TiDB + Capella)

| Dato | Fórmula | Fuente |
|---|---|---|
| `usuarios` | `COUNT(*)` de `usuario` | TiDB |
| `usuarios_activos` | usuarios con `estatus = 'activo'` | TiDB |
| `porcentaje_activos` | `usuarios_activos / usuarios × 100` | TiDB |
| `usuarios_con_consentimiento` | usuarios con `consentimiento_datos = TRUE` | TiDB |
| `interacciones` | documentos en `interacciones` | Capella |
| `usuarios_que_interactuan` | `id_usuario` distintos en `interacciones` | Capella |
| `sentimiento_promedio` | promedio de `sentimiento` de todas las interacciones (-1 a 1) | Capella |
| `en_cuarentena` | documentos en `cuarentena` | Capella |
| `generado_en` | momento del cálculo, UTC | API |

## `GET /api/metricas/estatus` (TiDB)

Usuarios por `estatus` (`activo`, `en_riesgo`, `inactivo`), siempre los tres y en ese orden, con `porcentaje = usuarios del estatus / total × 100`. El estatus lo calculó el ETL por días desde `ultima_actividad`: hasta 14 días `activo`, hasta 60 `en_riesgo`, más de 60 `inactivo`.

## `GET /api/metricas/plataformas` (TiDB + Capella)

Por cada código del catálogo `plataforma`: `usuarios` (con esa `cod_plataforma`, TiDB) e `interacciones` (con ese `canal`, Capella). Incluye las plataformas con 0.

## `GET /api/metricas/temas` (TiDB + Capella)

Por cada código del catálogo `tema`: `interacciones` con ese `tema` y `sentimiento_promedio` de esas interacciones (`null` si no hay ninguna).

## `GET /api/metricas/tipos` (TiDB + Capella)

Por cada código del catálogo `tipo_interaccion`: `interacciones` con ese `tipo` y `porcentaje = interacciones del tipo / total × 100`. Incluye los tipos con 0. `nombre` sale del catálogo.

## `GET /api/metricas/etiquetas` (TiDB + Capella)

Por cada código del arreglo `etiquetas`: `interacciones` = número de interacciones distintas que la llevan (`UNNEST` + `COUNT(DISTINCT id)`). Se ordenan de mayor a menor (empate por código) y se devuelven las 10 primeras con uso mayor a 0. Una interacción con 3 etiquetas suma 1 a cada una, así que la suma puede pasar del total de interacciones. `nombre` sale del catálogo `etiqueta`.

## `GET /api/metricas/actividad` (Capella)

Mapa de calor: interacciones por `dia_semana` (1 = lunes … 7 = domingo) y `hora` (0 a 23) de su `timestamp`, **en UTC**. Siempre 168 celdas (7 × 24), con 0 donde no hay actividad.

## `GET /api/metricas/geografia` (TiDB) · privacidad

- Solo cuenta usuarios con `consentimiento_datos = TRUE` y fila en `ubicacion_usuario`.
- Agrupa por estado (`pais`, `estado`) y por ciudad (`pais`, `estado`, `ciudad`). Nunca usa ni devuelve coordenadas ni `id_usuario`.
- **Oculta todo grupo con menos de 3 usuarios** (`minimo_por_grupo`), para que nadie pueda ser identificado por vivir en un lugar con 1 o 2 personas.
- `usuarios_con_ubicacion` es el total de usuarios contados, incluidos los de grupos ocultos.

## `GET /api/metricas/demografia` (TiDB)

| Dato | Fórmula |
|---|---|
| `total` | `COUNT(*)` de `usuario` |
| `rangos_edad[].usuarios` | usuarios con ese `cod_rango_edad`; `porcentaje = usuarios / total × 100` |
| `intereses[].usuarios` | usuarios con ese `cod_interes` (interés principal); mismo `porcentaje` |
| `cruce[].usuarios` | usuarios con ese `cod_rango_edad` **y** ese `cod_interes` |

Las dos listas traen todos los códigos del catálogo (con 0 si nadie lo tiene). No usa ubicación.

## `GET /api/metricas/puntos-calientes` (TiDB) · privacidad

Mapa de calor geográfico. **Cuadrícula de 0.2°** (unos 22 km de lado en Yucatán): con 0.1° se ocultaban 38 de 114 cuadros (56 usuarios fuera del mapa); con 0.2° se ocultan 9 de 61 (13 usuarios) y sigue sin señalar una colonia ni una calle.

| Dato | Fórmula |
|---|---|
| número de cuadro | `k_lat = FLOOR(latitud / 0.2)`, `k_lon = FLOOR(longitud / 0.2)`, calculado en TiDB |
| `latitud_centro`, `longitud_centro` | `k × 0.2 + 0.1` (centro del cuadro, 1 decimal) |
| `usuarios` | usuarios con `consentimiento_datos = TRUE` y coordenadas en ese cuadro |
| `usuarios_con_coordenadas` | suma de todos los cuadros, incluidos los ocultos |
| `usuarios_en_mapa` | suma de los cuadros visibles |

- TiDB agrupa y devuelve solo `k_lat`, `k_lon` y el conteo: las coordenadas de cada usuario no salen de la base.
- **Oculta todo cuadro con menos de 3 usuarios** (`minimo_por_cuadro`), igual que `geografia`.
- Nunca devuelve `id_usuario` ni una coordenada sin llevar al centro de su cuadro.

## Cómo cambian con altas, cambios y bajas

El CRUD (F4-01) solo escribe interacciones en Capella. Las consultas usan `request_plus`, así que cada cambio se ve en la siguiente petición. Después de cada alta, cambio o baja exitosa, `/ws/metricas` manda el resumen nuevo con `cambio` (`creada`, `editada` o `borrada` y el `id_interaccion`); el dashboard vuelve a pedir las demás métricas.

| Indicador | Alta (`POST`) | Cambio (`PUT`) | Baja (`DELETE`) |
|---|---|---|---|
| `interacciones` | +1 | igual | −1 |
| `usuarios_que_interactuan` | +1 si es la primera del usuario | puede cambiar si cambia `id_usuario` | −1 si era la última del usuario |
| `sentimiento_promedio` (resumen y por tema) | se recalcula con el nuevo valor | se recalcula | se recalcula sin ella |
| `plataformas.interacciones` | +1 en su `canal` | pasa de un canal a otro si cambia | −1 en su `canal` |
| `temas.interacciones` | +1 en su `tema` | pasa de un tema a otro si cambia | −1 en su `tema` |
| `actividad` | +1 en la celda de su `timestamp` | cambia de celda si cambia `timestamp` | −1 en su celda |
| `tipos.interacciones` (y `total`, `porcentaje`) | +1 en su `tipo`; todos los porcentajes se recalculan | pasa de un tipo a otro si cambia | −1 en su `tipo` |
| `etiquetas.interacciones` | +1 en cada etiqueta que lleva; el top 10 puede reordenarse | −1 en las que quita, +1 en las que agrega | −1 en cada etiqueta que llevaba |
| `usuarios`, `usuarios_activos`, `porcentaje_activos`, `usuarios_con_consentimiento`, `estatus`, `geografia`, `puntos-calientes`, `demografia` | no cambian | no cambian | no cambian |
| `en_cuarentena` | no cambia: un dato inválido da `422` y no se guarda | no cambia | no cambia |

`estatus` y `ultima_actividad` de TiDB los calculó el ETL. Una interacción creada desde la API no los recalcula.
