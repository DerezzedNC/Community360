import { useMemo } from 'react';
import LienzoEcharts from './LienzoEcharts';
import { escaparHtml, tooltipBase, useTemaGraficas } from './temaGraficas';

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

// Barras reutilizables. Categorías y series llegan por props; estados de carga, vacío y error.
export default function GraficaBarras({
  categorias,
  series,
  horizontal = false,
  decimales = null,
  altura = '300px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Gráfica de barras',
  tabla = null,
}) {
  const tema = useTemaGraficas();
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

    const etiquetaEje = { color: tema.texto2, fontSize: 12, fontFamily: tema.fuente };
    const variasSeries = series.length > 1;
    const rotar = !horizontal && categorias.length > 5;

    const ejeCategorias = {
      type: 'category',
      data: categorias,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...etiquetaEje,
        interval: 0,
        rotate: rotar ? 30 : 0,
        width: horizontal ? 140 : 96,
        overflow: 'truncate',
      },
    };

    const ejeValores = {
      type: 'value',
      min: (rango) => Math.min(0, rango.min), // las barras empiezan en 0
      minInterval: typeof decimales === 'number' ? undefined : 1,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tema.guia, width: 1 } },
      axisLabel: { ...etiquetaEje, formatter: (val) => formatearNumero(val, decimales) },
    };

    return {
      animation: tema.animacion,
      animationDurationUpdate: tema.duracion,
      textStyle: { fontFamily: tema.fuente },
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: tema.oscuro ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } },
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
      legend: variasSeries
        ? {
            top: 0,
            left: 0,
            icon: 'circle',
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 20,
            textStyle: { color: tema.texto, fontSize: 12, fontFamily: tema.fuente },
          }
        : undefined,
      grid: {
        top: variasSeries ? 40 : 12,
        right: horizontal ? 40 : 8,
        bottom: 4,
        left: 0,
        containLabel: true,
      },
      xAxis: horizontal ? ejeValores : ejeCategorias,
      yAxis: horizontal ? ejeCategorias : ejeValores,
      series: series.map((serie) => ({
        name: serie.nombre || '',
        type: 'bar',
        data: serie.datos || [],
        barMaxWidth: 28,
        barGap: '20%',
        // El dato clave se ve sin pasar el mouse
        label: variasSeries
          ? { show: false }
          : {
              show: true,
              position: horizontal ? 'right' : 'top',
              color: tema.texto,
              fontSize: 12,
              fontFamily: tema.fuente,
              formatter: (p) => formatearNumero(p.value, decimales),
            },
        itemStyle: {
          color: serie.color || tema.color('azul'),
          borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0],
        },
      })),
    };
  }, [categorias, decimales, horizontal, series, sinDatos, tema]);

  return (
    <LienzoEcharts
      opcion={opcion}
      altura={altura}
      cargando={cargando}
      error={error}
      sinDatos={sinDatos}
      alReintentar={alReintentar}
      etiquetaAria={etiquetaAria}
      forma="barras"
      tabla={tabla}
    />
  );
}
