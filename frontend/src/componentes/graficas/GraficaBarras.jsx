import { useMemo } from 'react';
import LienzoEcharts, { PALETA_C360 } from './LienzoEcharts';

// Componente reutilizable de barras. Recibe categorías y series por props.
// Maneja los estados: cargando, sin datos y error.
export default function GraficaBarras({
  categorias,
  series,
  horizontal = false,
  mostrarLeyenda = false,
  altura = '300px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Gráfica de barras',
}) {
  const tieneCategorias = Array.isArray(categorias) && categorias.length > 0;
  const tieneSeries =
    Array.isArray(series) &&
    series.length > 0 &&
    series.some((serie) => Array.isArray(serie?.datos) && serie.datos.length > 0);
  const sinDatos = !tieneCategorias || !tieneSeries;

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    const ejeCategorias = {
      type: 'category',
      data: categorias,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#475569', fontSize: 12 },
    };

    const ejeValores = {
      type: 'value',
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: '#475569', fontSize: 12 },
    };

    const leyendaActiva = mostrarLeyenda || series.length > 1;

    return {
      color: PALETA_C360,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: leyendaActiva
        ? {
            bottom: 0,
            textStyle: { color: '#475569', fontSize: 12 },
          }
        : undefined,
      grid: {
        top: 16,
        right: 20,
        bottom: leyendaActiva ? 38 : 16,
        left: 12,
        containLabel: true,
      },
      xAxis: horizontal ? ejeValores : ejeCategorias,
      yAxis: horizontal ? ejeCategorias : ejeValores,
      series: series.map((serie) => ({
        name: serie.nombre || '',
        type: 'bar',
        data: serie.datos || [],
        barMaxWidth: 34,
        itemStyle: {
          borderRadius: horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0],
        },
      })),
    };
  }, [categorias, horizontal, mostrarLeyenda, series, sinDatos]);

  return (
    <LienzoEcharts
      opcion={opcion}
      altura={altura}
      cargando={cargando}
      error={error}
      sinDatos={sinDatos}
      alReintentar={alReintentar}
      etiquetaAria={etiquetaAria}
    />
  );
}
