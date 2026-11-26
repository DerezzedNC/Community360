# Guía de diseño · COMMUNITY 360 (F7-01)

Inspirada en el lenguaje visual de apple.com/mx (Store, iPhone 18 Pro, AirPods Pro), en los detalles de interfaz oscura de raycast.com y en las **Human Interface Guidelines (HIG)** de Apple (developer.apple.com/design/human-interface-guidelines). Los valores visuales se midieron con los estilos calculados de esas páginas (nov 2026); las reglas de la sección 6 resumen las HIG que aplican a un dashboard de datos web.

**Inspiración, no copia:** nada de logos, imágenes, íconos ni textos de Apple o Raycast, y no se descargan las fuentes SF Pro (licencia exclusiva de Apple). El nombre de la marca en la interfaz es solo "COMMUNITY 360".

## 1. Tokens (variables CSS)

### Modo claro (por defecto; como la Apple Store)
| Token | Valor | Uso |
|---|---|---|
| `--fondo` | `#f5f5f7` | fondo de página |
| `--superficie` | `#ffffff` | tarjetas, modales, tablas |
| `--relleno` | `#e8e8ed` | insignias, controles segmentados, celdas vacías |
| `--separador` | `#d2d2d7` | líneas de tabla y bordes de campos |
| `--texto` | `#1d1d1f` | texto principal y números |
| `--texto-2` | `#6e6e73` | subtítulos y descripciones |
| `--texto-3` | `#86868b` | solo texto grande o decorativo (no pasa AA en texto pequeño sobre blanco) |
| `--acento` | `#0071e3` | botones primarios y selección |
| `--enlace` | `#0066cc` | enlaces de texto |

### Modo oscuro (automático, como la página del iPhone Pro y Raycast)
| Token | Valor |
|---|---|
| `--fondo` | `#000000` |
| `--superficie` | `#1d1d1f` |
| `--superficie-2` | `#2a2a2d` |
| `--borde` | `1px solid rgba(255,255,255,0.10)` (detalle de Raycast) |
| `--texto` | `#f5f5f7` |
| `--texto-2` | `#86868b` |
| `--enlace` | `#2997ff` |

**Sin botón de modo.** Las HIG piden no ofrecer un ajuste de apariencia propio de la app: el dashboard sigue la preferencia del sistema con `@media (prefers-color-scheme: dark)`. Para las capturas del documento basta con poner el sistema en modo claro.

### Colores para datos (colores de sistema de las HIG, valores vigentes)
| Color | Claro | Oscuro | Alto contraste (claro) |
|---|---|---|---|
| Azul | `#0088FF` | `#0091FF` | `#1E6EF4` |
| Verde | `#34C759` | `#30D158` | `#008932` |
| Naranja | `#FF8D28` | `#FF9230` | `#C55300` |
| Rojo | `#FF383C` | `#FF4245` | `#E9152D` |
| Morado | `#CB30E0` | `#DB34F2` | `#B02FC2` |
| Índigo | `#6155F5` | `#6D7CFF` | `#564ADE` |
| Cian | `#00C0E8` | `#3CD3FE` | `#007EAE` |
| Menta | `#00C8B3` | `#00DAC3` | `#008575` |
| Rosa | `#FF2D55` | `#FF375F` | `#E7124D` |
| Café | `#AC7F5E` | `#B78A66` | `#956D51` |

Grises de sistema (claro / oscuro): gray `#8E8E93`/`#8E8E93`, gray2 `#AEAEB2`/`#636366`, gray3 `#C7C7CC`/`#48484A`, gray4 `#D1D1D6`/`#3A3A3C`, gray5 `#E5E5EA`/`#2C2C2E`, gray6 `#F2F2F7`/`#1C1C1E`.

- **Rellenos de gráficas:** columna "Claro" u "Oscuro" según el modo.
- **Texto, íconos o líneas finas de color** (por ejemplo, la palabra "En riesgo" en naranja): columna "Alto contraste", porque los colores normales no llegan a 4.5:1 sobre blanco. También se usa con `@media (prefers-contrast: more)`.
- **Botones con texto blanco:** `--acento` `#0071e3` (4.6:1). El azul de sistema `#0088FF` no alcanza el contraste con texto blanco pequeño.
- Estatus: activo = verde, en riesgo = naranja, inactivo = gray. Siempre con su texto, nunca solo el color.
- **Un color fijo por categoría en todo el dashboard:** la misma plataforma, tema o tipo usa el mismo color en todas las gráficas (asignado por el orden del catálogo, no al azar).
- Mapas de calor: una sola gama del azul, de `#E5F1FF` a `#0071E3`.

## 2. Tipografía
Pila: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif` (en Mac se ve SF; en Windows, Segoe UI).

| Rol | Tamaño / peso | Interletrado | Interlineado |
|---|---|---|---|
| Título de página (hero) | 48 px / 600 (64 px en pantallas ≥ 1068 px) | `-0.009em` | 1.07 |
| Título de sección | 40 px / 600 | `0` | 1.1 |
| Título de tarjeta | 24 px / 600 (21 px en móvil) | `0.009em` | 1.17 |
| Número KPI | 48 px / 600, `font-variant-numeric: tabular-nums` | `-0.009em` | 1.05 |
| Texto normal | 17 px / 400 | `-0.022em` | 1.47 |
| Texto secundario | 14 px / 400 | `-0.016em` | 1.43 |
| Etiqueta pequeña ("NUEVO") | 12 px / 600, color `--texto-2` | `-0.01em` | 1.33 |
| Nota / leyenda | 12 px / 400, color `--texto-2` | `-0.01em` | 1.33 |

**Títulos a dos tonos** (patrón de la Store, "Lo más nuevo. Opciones maravillosas…"): primera frase en `--texto`, el resto en `--texto-2`, mismo tamaño. Ej.: "**Comunidad en vivo.** Así se mueve hoy."

**Números grandes con leyenda corta** (patrón de las comparativas del iPhone): número a 48 px y debajo una leyenda de 12–14 px en gris.

## 3. Formas, sombras y movimiento
- Tarjetas: `border-radius: 28px`, sin borde, `box-shadow: 2px 4px 12px rgba(0,0,0,0.08)`, padding 28–32 px (20 en móvil).
- Hover de tarjeta: `transform: scale(1.01)` y sombra `2px 4px 16px rgba(0,0,0,0.16)`; `transition: box-shadow .3s cubic-bezier(0,0,.5,1), transform .3s cubic-bezier(0,0,.5,1)`.
- Elementos internos (mini-tarjetas, campos, gráficas): radio 12–18 px.
- Píldoras (botones, insignias, segmentados): `border-radius: 980px`.
- Botón primario: fondo `--acento`, texto blanco, 14–17 px / 400, padding `8px 16px` (pequeño `6px 12px`).
- Botón secundario: transparente, borde `1px solid --separador` (o `--borde` en oscuro).
- Teclas tipo Raycast (opcional para atajos): radio 6 px, 11 px, `box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15)`.
- Vidrio (barra y aviso flotante): fondo `rgba(255,255,255,0.72)` en claro o `rgba(42,42,45,0.72)` en oscuro, `backdrop-filter: saturate(180%) blur(20px)`.
- Fondo de modal: `rgba(0,0,0,0.4)` con `backdrop-filter: blur(20px)`; el modal, radio 28 px.
- Animaciones discretas (entrada de tarjetas: opacidad + 8 px hacia arriba, 0.4 s). Todo se desactiva con `prefers-reduced-motion: reduce`.

## 4. Estructura del dashboard
1. **Barra superior flotante tipo píldora** (como la barra local del iPhone Pro): fija arriba con 12 px de margen, radio 980 px, vidrio, alto 52 px. Contenido: "COMMUNITY 360" a la izquierda; Métricas · Usuarios · Cuarentena al centro; a la derecha, indicador de conexión ("● En vivo" con punto verde, o "○ Sin conexión" en gris: texto además del color), botón "Actualizar en vivo", nombre y rol en una píldora y "Cerrar sesión". En móvil se reduce a marca + menú. Los controles dentro de la barra usan radios concéntricos (radio interno = radio de la barra − su margen interno).
2. **Encabezado** con título a dos tonos y la hora del último cálculo (`generado_en`) como nota.
3. **Fila de KPI**: números grandes con leyenda. En móvil, carrusel horizontal con `scroll-snap` (como los estantes de la Store).
4. **Rejilla tipo bento** (`gap: 20px`, máximo ~1200 px de ancho, centrada): tarjetas de distinto tamaño; el mapa geográfico y el mapa de calor ocupan el ancho completo.
5. **Insignias de privacidad** en píldora `--relleno` con texto 12 px: "Solo con consentimiento", "Cuadros con 3 usuarios o más".
6. **Aviso flotante de cambios** (como la píldora "Comparar los modelos" al pie del iPhone Pro): abajo al centro, vidrio, radio 980 px: "Interacción creada · ID … · hace 3 s". Aparece y se desvanece.
7. **Tablas**: sin líneas verticales, separadores de 1 px `--separador`, encabezados de 12 px / 600 en `--texto-2`, filas de 48 px, hover `--fondo`.
8. **Login**: tarjeta centrada de radio 28 px sobre `--fondo`, título "Inicia sesión." a dos tonos, campos de 52 px de alto, radio 12 px, borde `--separador`, foco `box-shadow: 0 0 0 4px rgba(0,113,227,0.25)`.

## 5. Gráficas (tema de ECharts)
- Sin bordes de ejes ni marcas; solo líneas guía horizontales de 1 px `#e8e8ed` (`rgba(255,255,255,0.08)` en oscuro).
- Etiquetas de ejes de 12 px en `--texto-2`; leyenda arriba a la izquierda, íconos circulares.
- Barras con esquinas superiores de 6 px y `barMaxWidth: 28`.
- Dona con el total grande al centro (número 32 px / 600 + leyenda 12 px).
- Tooltip: fondo `--superficie`, sin borde, radio 12 px, sombra de tarjeta, texto 13 px.
- Mapa geográfico: fondo de mapa claro y sobrio (por ejemplo CARTO Positron con su atribución obligatoria, o el de OpenStreetMap con filtro gris). Manchas de calor en la gama azul.

## 6. Reglas de las HIG aplicadas al dashboard

### Principios
- **Propósito y sencillez:** cada elemento se gana su lugar. Lo más importante arriba a la izquierda (orden de lectura); agrupar con espacio en blanco y tarjetas, no con líneas.
- **Responsabilidad:** ser transparente con los datos. Las insignias de privacidad ("Solo con consentimiento", "Cuadros con 3 usuarios o más") son parte del diseño, no un adorno.
- **Familiaridad y consistencia:** un mismo componente se ve y se comporta igual en todo el dashboard.

### Gráficas ("Charting data" y "Charts")
- **Tipos comunes:** barras, dona, mapa de calor. Nada de gráficas novedosas que haya que aprender.
- **Cada gráfica tiene título, subtítulo con unidades y una frase-resumen** arriba, calculada con los datos reales de la API, con valores concretos y sin adjetivos subjetivos ("Discord: 58 interacciones, el canal con más actividad", no "Discord crece rápidamente"). Nunca texto fijo con números.
- **No exigir interacción para ver lo esencial:** el dato clave se ve sin pasar el mouse; el tooltip solo amplía.
- **Ejes:** las barras empiezan en 0; marcas en secuencias familiares (0, 5, 10 o 0, 25, 50); pocas líneas guía y etiquetas claras para que el dato sea lo más visible. Etiquetas del eje vertical cortas; las unidades van en el subtítulo.
- **No depender solo del color:** leyenda con texto, valores en el tooltip y, en la dona, etiquetas con nombre y porcentaje. Separadores de 2 px del color de la superficie entre segmentos de la dona y entre celdas del mapa de calor.
- **Continuidad:** si dos gráficas muestran los mismos datos, mismo tipo y mismos colores.
- **Cambios visibles:** cuando el WebSocket actualiza una gráfica, se anima la transición (breve) **y** se avisa con texto (el aviso flotante y la hora de "Actualizado").
- **Accesibilidad:** cada gráfica en un contenedor con `role="img"` y `aria-label` que diga tipo, qué muestra cada eje y el resumen. Un botón "Ver datos" muestra la misma información en una tabla (divulgación progresiva y alternativa accesible).
- **Alineación:** el borde izquierdo de cada gráfica alineado con el título de su tarjeta.

### Mapa geográfico ("Maps")
- Interactivo (zoom y arrastre), con estilo **atenuado** (desaturado), porque encima va información; por ejemplo CARTO Positron.
- La atribución del mapa siempre visible, con margen, nunca tapada por controles.
- Al seleccionar un cuadro: contorno y cambio de color, y un pequeño globo con el número de usuarios.

### Materiales ("Materials")
- **El vidrio solo va en la capa de controles y navegación** (barra superior, aviso flotante, controles segmentados flotantes). Nunca en las tarjetas ni en el contenido: ahí se usan superficies sólidas.
- Con `@media (prefers-reduced-transparency: reduce)` el vidrio pasa a fondo sólido (`--superficie`).

### Modo oscuro y contraste ("Dark Mode", "Accessibility")
- Sigue la preferencia del sistema; sin botón propio.
- Contraste mínimo 4.5:1 en texto de hasta 17 px y 3:1 en texto de 18 px o más o en negritas; buscar 7:1 en texto pequeño con colores propios. Revisar en claro y en oscuro.
- Con `@media (prefers-contrast: more)`: bordes de 1 px visibles en las tarjetas y colores de la columna "Alto contraste".
- Tamaños en `rem` para que el zoom del navegador al 200 % no rompa el diseño. Texto mínimo 12 px; texto normal 15 a 17 px. Nada de pesos finos (Light o Thin): solo 400, 500, 600 y 700.

### Movimiento ("Motion")
- Animaciones con propósito, breves (0.2 a 0.4 s) y que nunca bloqueen: se puede seguir usando la pantalla mientras ocurren.
- Nada de animaciones en interacciones muy frecuentes (filas de tabla, cambiar de página): solo cambio de color de fondo.
- El movimiento nunca es la única forma de comunicar algo. Con `prefers-reduced-motion: reduce` se quitan desplazamientos y escalas.

### Carga y retroalimentación ("Loading", "Progress indicators", "Feedback")
- **Mostrar algo de inmediato:** marcadores de carga (esqueletos) con la forma de cada tarjeta y gráfica; nunca una pantalla en blanco. Spinner solo en acciones cortas.
- **Estado integrado cerca de lo que describe:** "Actualizado hace 5 s" en el encabezado, el indicador de conexión en la barra. Sin alertas modales para cosas normales.
- **Errores junto al problema, sin culpar y diciendo qué hacer:** "No se pudo conectar con la base de datos. Revisa la conexión y elige Reintentar." Sin "¡Ups!" ni interjecciones.
- **Estados vacíos útiles:** "No hay usuarios con estos filtros. Prueba quitando alguno." con un botón "Quitar filtros".

### Escritura ("Writing")
- Voz clara y directa, en español sencillo; mayúscula solo al inicio de la frase (también en botones y encabezados de columna).
- Botones con verbo: "Reintentar", "Ver detalle", "Ver datos", "Cerrar sesión", "Quitar filtros". Nunca "Haz clic aquí".
- Sin posesivos innecesarios ("Usuarios", no "Tus usuarios") y sin "nosotros".
- Términos fijos en todo el dashboard: interacción, usuario, cuarentena, estatus, consentimiento.
- Fechas sin ambigüedad: "25 nov 2026, 20:15", no "25/11".

### Componentes
- **Botones:** área de clic de al menos 44 × 44 px (aunque el dibujo sea más chico); estado presionado visible (`:active` con opacidad 0.7 o escala 0.97); como máximo uno o dos botones destacados (azules) por vista; la preferencia se marca con el estilo, no con el tamaño.
- **Controles segmentados** para conmutadores como Estados/Ciudades o Interacciones/Sentimiento: de 2 a 5 segmentos del mismo ancho, solo texto, con el seleccionado en `--superficie` sobre fondo `--relleno`.
- **Tablas:** encabezados con sustantivos cortos y sin punto final; texto breve en cada celda; los ID largos se recortan por el centro ("U0001…4567") para conservar inicio y fin; la fila elegida se resalta.
- **Campos del login:** etiqueta visible además del texto de ejemplo; contraseña oculta; validación al salir del campo; el mensaje de error debajo del campo.
- **Modales (hojas):** uno a la vez, botón "Cerrar", se cierran con Esc, el foco queda dentro mientras están abiertos y regresa al botón que los abrió.
- **Navegación:** con tres secciones basta la barra superior; máximo dos niveles de jerarquía.

## 7. Reglas que no cambian
Solo estilo y presentación. No se tocan las llamadas a la API, el WebSocket, la sesión, las rutas protegidas, la privacidad ni los filtros en la URL. Sin datos fijos ni formularios de CRUD. Contraste mínimo WCAG AA: el texto pequeño usa `--texto` o `--texto-2` (`#6e6e73`); `#86868b` solo en texto grande o en modo oscuro.
