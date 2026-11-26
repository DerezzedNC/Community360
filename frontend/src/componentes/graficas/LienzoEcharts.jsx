import { useEffect, useId, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

export { escaparHtml } from './temaGraficas';

echarts.use([
  BarChart,
  PieChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

// Marcador de carga con la forma de la gráfica (HIG: mostrar algo de inmediato)
export function EsqueletoGrafica({ forma = 'barras', altura }) {
  return (
    <div
      className={`esqueleto esqueleto--${forma}`}
      style={{ minHeight: altura }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando datos</span>
      {forma === 'dona' && <span className="esqueleto__dona" aria-hidden="true" />}
      {forma === 'barras' &&
        [72, 48, 88, 36, 60].map((ancho) => (
          <span key={ancho} className="esqueleto__barra" style={{ width: `${ancho}%` }} aria-hidden="true" />
        ))}
      {(forma === 'calor' || forma === 'mapa') && <span className="esqueleto__bloque" aria-hidden="true" />}
    </div>
  );
}

// Error junto al problema, sin culpar y diciendo qué hacer
export function ErrorGrafica({ error, alReintentar, altura }) {
  const detalle = String(error || '').replace(/\.$/, '');
  return (
    <div className="estado-grafica estado-grafica--error" style={{ minHeight: altura }} role="alert">
      <p className="estado-grafica__titulo">No se pudieron cargar estos datos.</p>
      <p className="estado-grafica__texto">
        {detalle ? `${detalle}. ` : ''}Revisa la conexión y elige Reintentar.
      </p>
      {typeof alReintentar === 'function' && (
        <button type="button" className="boton boton--secundario" onClick={alReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// Alternativa accesible: la misma información en una tabla (divulgación progresiva).
// El pie lleva la ruta de la API como evidencia, en una línea pequeña (§8.3).
export function TablaDatos({ tabla, fuente = '' }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  const hayTabla = tabla && Array.isArray(tabla.filas) && tabla.filas.length > 0;
  if (!hayTabla && !fuente) {
    return null;
  }
  return (
    <div className="ver-datos">
      <div className="ver-datos__pie">
        {hayTabla && (
          <button
            type="button"
            className="boton boton--secundario boton--chico"
            aria-expanded={abierta}
            aria-controls={id}
            onClick={() => setAbierta((previo) => !previo)}
          >
            {abierta ? 'Ocultar datos' : 'Ver datos'}
          </button>
        )}
        {fuente && <code className="ver-datos__fuente">{fuente}</code>}
      </div>
      {hayTabla && abierta && (
        <div id={id} className="contenedor-tabla ver-datos__tabla">
          <table className="tabla-datos tabla-datos--compacta">
            <caption className="sr-only">{tabla.titulo}</caption>
            <thead>
              <tr>
                {tabla.columnas.map((columna, indice) => (
                  <th key={columna} scope="col" className={indice > 0 ? 'celda-numero' : undefined}>
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila, indiceFila) => (
                <tr key={indiceFila}>
                  {fila.map((celda, indice) => (
                    <td key={indice} className={indice > 0 ? 'celda-numero' : undefined}>
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LienzoEcharts({
  opcion,
  altura = '300px',
  cargando = false,
  error = '',
  sinDatos = false,
  textoSinDatos = 'Todavía no hay datos para esta gráfica.',
  alReintentar,
  etiquetaAria = 'Gráfica',
  forma = 'barras',
  tabla = null,
  fuente = '',
  resaltar = null, // [{ seriesIndex, dataIndex }] que cambiaron en la última actualización
}) {
  const contenedorRef = useRef(null);
  const instanciaRef = useRef(null);
  // La gráfica se crea al entrar en pantalla: así su animación de dibujo se ve (§8.3)
  const [enPantalla, setEnPantalla] = useState(false);

  const mostrarGrafica = !cargando && !error && !sinDatos && Boolean(opcion);

  useEffect(() => {
    if (!mostrarGrafica || enPantalla || !contenedorRef.current) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setEnPantalla(true);
      return undefined;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setEnPantalla(true);
          observador.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observador.observe(contenedorRef.current);
    return () => observador.disconnect();
  }, [enPantalla, mostrarGrafica]);

  useEffect(() => {
    if (!mostrarGrafica || !enPantalla || !contenedorRef.current) {
      return undefined;
    }

    const nodo = contenedorRef.current;
    const instancia = echarts.init(nodo);
    instanciaRef.current = instancia;

    const observador = new ResizeObserver(() => {
      instancia.resize();
    });
    observador.observe(nodo);

    return () => {
      observador.disconnect();
      instancia.dispose();
      instanciaRef.current = null;
    };
  }, [enPantalla, mostrarGrafica]);

  useEffect(() => {
    if (mostrarGrafica && enPantalla && instanciaRef.current && opcion) {
      // Sin reemplazar todo: ECharts anima la transición cuando llegan datos nuevos
      instanciaRef.current.setOption(opcion, { notMerge: false, replaceMerge: ['series', 'xAxis', 'yAxis'] });
    }
  }, [enPantalla, mostrarGrafica, opcion]);

  // Resaltado del cambio: lo que cambió se ilumina 1.5 s (comparando datos anterior y nuevo)
  useEffect(() => {
    const instancia = instanciaRef.current;
    if (!instancia || !Array.isArray(resaltar) || resaltar.length === 0) {
      return undefined;
    }
    const porSerie = new Map();
    for (const { seriesIndex, dataIndex } of resaltar) {
      porSerie.set(seriesIndex, [...(porSerie.get(seriesIndex) || []), dataIndex]);
    }
    porSerie.forEach((indices, seriesIndex) => instancia.dispatchAction({ type: 'highlight', seriesIndex, dataIndex: indices }));
    const temporizador = window.setTimeout(() => {
      porSerie.forEach((indices, seriesIndex) => instancia.dispatchAction({ type: 'downplay', seriesIndex, dataIndex: indices }));
    }, 1500);
    return () => window.clearTimeout(temporizador);
  }, [resaltar]);

  if (cargando) {
    return <EsqueletoGrafica forma={forma} altura={altura} />;
  }

  if (error) {
    return <ErrorGrafica error={error} alReintentar={alReintentar} altura={altura} />;
  }

  if (sinDatos) {
    return (
      <>
        <div className="estado-grafica" style={{ minHeight: altura }} role="status">
          <p className="estado-grafica__texto">{textoSinDatos}</p>
        </div>
        <TablaDatos tabla={null} fuente={fuente} />
      </>
    );
  }

  return (
    <>
      <div
        ref={contenedorRef}
        className="lienzo-echarts"
        style={{ height: altura }}
        role="img"
        aria-label={etiquetaAria}
      />
      <TablaDatos tabla={tabla} fuente={fuente} />
    </>
  );
}

// Compara las series anterior y nueva por nombre de categoría y devuelve lo que cambió
export function compararSeries(anterior, categorias, series) {
  if (!anterior) return null;
  const cambios = [];
  series.forEach((serie, seriesIndex) => {
    const previo = anterior.get(serie.nombre);
    if (!previo) return;
    (serie.datos || []).forEach((valor, dataIndex) => {
      const nombre = categorias[dataIndex];
      if (previo.has(nombre) && Number(previo.get(nombre)) !== Number(valor)) {
        cambios.push({ seriesIndex, dataIndex });
      }
    });
  });
  return cambios;
}

export function fotografiarSeries(categorias, series) {
  return new Map(series.map((serie) => [serie.nombre, new Map((serie.datos || []).map((v, i) => [categorias[i], v]))]));
}
