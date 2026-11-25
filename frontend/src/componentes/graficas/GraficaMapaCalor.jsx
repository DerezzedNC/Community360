import { useMemo } from 'react';
import LienzoEcharts from './LienzoEcharts';

// Componente reutilizable de mapa de calor.
// No asume qué dimensión va en cada eje: ejes y celdas llegan íntegramente desde la API por props.
// Maneja los estados: cargando, sin datos y error.
export default function GraficaMapaCalor({
  etiquetasHorizontal,
  etiquetasVertical,
  tituloHorizontal = '',
  tituloVertical = '',
  celdas,
  altura = '340px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Mapa de calor de actividad',
}) {
  const tieneHorizontal =
    Array.isArray(etiquetasHorizontal) && etiquetasHorizontal.length > 0;
  const tieneVertical =
    Array.isArray(etiquetasVertical) && etiquetasVertical.length > 0;
  const tieneCeldas = Array.isArray(celdas) && celdas.length > 0;
  const sinDatos = !tieneHorizontal || !tieneVertical || !tieneCeldas;

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    let minimo = Infinity;
    let maximo = -Infinity;

    for (const celda of celdas) {
      const valor = Array.isArray(celda) ? Number(celda[2]) : NaN;
      if (!Number.isNaN(valor)) {
        if (valor < minimo) minimo = valor;
        if (valor > maximo) maximo = valor;
      }
    }

    if (!Number.isFinite(minimo)) minimo = 0;
    if (!Number.isFinite(maximo)) maximo = minimo;

    return {
      tooltip: {
        position: 'top',
      },
      grid: {
        top: 20,
        right: 24,
        bottom: 56,
        left: 16,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        name: tituloHorizontal,
        nameLocation: 'middle',
        nameGap: 28,
        data: etiquetasHorizontal,
        splitArea: { show: true },
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        name: tituloVertical,
        data: etiquetasVertical,
        splitArea: { show: true },
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      visualMap: {
        min: minimo,
        max: maximo,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#eff6ff', '#93c5fd', '#2563eb', '#1e3a8a'],
        },
        textStyle: { color: '#475569', fontSize: 11 },
      },
      series: [
        {
          type: 'heatmap',
          data: celdas,
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowColor: 'rgba(15, 23, 42, 0.25)',
            },
          },
        },
      ],
    };
  }, [
    celdas,
    etiquetasHorizontal,
    etiquetasVertical,
    sinDatos,
    tituloHorizontal,
    tituloVertical,
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
