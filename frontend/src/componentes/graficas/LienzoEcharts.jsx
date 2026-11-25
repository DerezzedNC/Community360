import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

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

export const PALETA_C360 = [
  '#2563eb',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

export default function LienzoEcharts({
  opcion,
  altura = '300px',
  cargando = false,
  error = '',
  sinDatos = false,
  alReintentar,
  etiquetaAria = 'Gráfica analítica',
}) {
  const contenedorRef = useRef(null);
  const instanciaRef = useRef(null);

  const mostrarGrafica = !cargando && !error && !sinDatos && Boolean(opcion);

  useEffect(() => {
    if (!mostrarGrafica || !contenedorRef.current) {
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
  }, [mostrarGrafica]);

  useEffect(() => {
    if (mostrarGrafica && instanciaRef.current && opcion) {
      instanciaRef.current.setOption(opcion, true);
    }
  }, [mostrarGrafica, opcion]);

  if (cargando) {
    return (
      <div
        className="estado-grafica"
        style={{ minHeight: altura }}
        role="status"
        aria-live="polite"
      >
        <span className="indicador-carga" aria-hidden="true" />
        <p className="estado-grafica__texto">Cargando datos…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="estado-grafica estado-grafica--error"
        style={{ minHeight: altura }}
        role="alert"
      >
        <p className="estado-grafica__titulo">No se pudo cargar la gráfica</p>
        <p className="estado-grafica__texto">{error}</p>
        {typeof alReintentar === 'function' && (
          <button
            type="button"
            className="boton-secundario"
            onClick={alReintentar}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (sinDatos) {
    return (
      <div
        className="estado-grafica"
        style={{ minHeight: altura }}
        role="status"
      >
        <p className="estado-grafica__texto">Sin datos disponibles</p>
      </div>
    );
  }

  return (
    <div
      ref={contenedorRef}
      className="lienzo-echarts"
      style={{ height: altura }}
      role="img"
      aria-label={etiquetaAria}
    />
  );
}
