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

## `GET /api/metricas/actividad` (Capella)

Mapa de calor: interacciones por `dia_semana` (1 = lunes … 7 = domingo) y `hora` (0 a 23) de su `timestamp`, **en UTC**. Siempre 168 celdas (7 × 24), con 0 donde no hay actividad.

## `GET /api/metricas/geografia` (TiDB) · privacidad

- Solo cuenta usuarios con `consentimiento_datos = TRUE` y fila en `ubicacion_usuario`.
- Agrupa por estado (`pais`, `estado`) y por ciudad (`pais`, `estado`, `ciudad`). Nunca usa ni devuelve coordenadas ni `id_usuario`.
- **Oculta todo grupo con menos de 3 usuarios** (`minimo_por_grupo`), para que nadie pueda ser identificado por vivir en un lugar con 1 o 2 personas.
- `usuarios_con_ubicacion` es el total de usuarios contados, incluidos los de grupos ocultos.

## Cómo cambian con altas, cambios y bajas

Se completa en F6-01, cuando exista el CRUD (F4-01) y los eventos del WebSocket.
