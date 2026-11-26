import { useMemo } from 'react';
import LienzoEcharts, { PALETA_C360, escaparHtml } from './LienzoEcharts';

function formatearNumero(valor, decimales) {
  const num = Number(valor);
  if (Number.isNaN(num)) {
    return '—';
  }
  if (typeof decimales === 'number') {
    return num.toFixed(decimales);
  }
  return num.toLocaleString('es-MX');
}

// Componente reutilizable de barras. Recibe categorías y series por props.
// Maneja los estados: cargando, sin datos y error.
export default function GraficaBarras({
  categorias,
  series,
  horizontal = false,
  mostrarLeyenda = false,
  tituloEjeValores = '',
  decimales = null,
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
    series.some(
      (serie) => Array.isArray(serie?.datos) && serie.datos.length > 0
    );
  const sinDatos = !tieneCategorias || !tieneSeries;

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    const rotarEtiquetasVerticales = !horizontal && categorias.length > 4;

    const ejeCategorias = {
      type: 'category',
      data: categorias,
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: {
        color: '#334155',
        fontSize: 11,
        interval: 0,
        rotate: rotarEtiquetasVerticales ? 20 : 0,
        width: horizontal ? 135 : 95,
        overflow: 'truncate',
      },
    };

    const ejeValores = {
      type: 'value',
      name: tituloEjeValores,
      nameTextStyle: {
        color: '#64748b',
        fontSize: 11,
        padding: horizontal ? [0, 0, 0, 4] : [0, 0, 4, 0],
      },
      minInterval: typeof decimales === 'number' ? undefined : 1,
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      axisLabel: {
        color: '#475569',
        fontSize: 11,
        formatter: (val) => formatearNumero(val, decimales),
      },
    };

    const leyendaActiva = mostrarLeyenda || series.length > 1;

    return {
      color: PALETA_C360,
      animationDurationUpdate: 320,
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (parametros) => {
          const lista = Array.isArray(parametros) ? parametros : [parametros];
          if (lista.length === 0) return '';
          const encabezado = `<strong>${escaparHtml(lista[0].axisValueLabel || lista[0].name)}</strong>`;
          const lineas = lista.map(
            (item) =>
              `${item.marker} ${escaparHtml(item.seriesName)}: <strong>${formatearNumero(item.value, decimales)}</strong>`
          );
          return [encabezado, ...lineas].join('<br/>');
        },
      },
      legend: leyendaActiva
        ? {
            bottom: 0,
            type: 'scroll',
            itemWidth: 12,
            itemHeight: 12,
            textStyle: { color: '#334155', fontSize: 12 },
          }
        : undefined,
      grid: {
        top: tituloEjeValores && !horizontal ? 32 : 16,
        right: horizontal && tituloEjeValores ? 34 : 20,
        bottom: leyendaActiva
          ? 42
          : rotarEtiquetasVerticales
            ? 24
            : 14,
        left: 10,
        containLabel: true,
      },
      xAxis: horizontal ? ejeValores : ejeCategorias,
      yAxis: horizontal ? ejeCategorias : ejeValores,
      series: series.map((serie) => ({
        name: serie.nombre || '',
        type: 'bar',
        data: serie.datos || [],
        barMaxWidth: 32,
        barGap: '18%',
        itemStyle: {
          color: serie.color || undefined,
          borderRadius: horizontal
            ? [0, 5, 5, 0]
            : [5, 5, 0, 0],
        },
      })),
    };
  }, [
    categorias,
    decimales,
    horizontal,
    mostrarLeyenda,
    series,
    sinDatos,
    tituloEjeValores,
  ]);

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
