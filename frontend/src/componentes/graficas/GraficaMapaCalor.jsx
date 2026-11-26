import { useMemo } from 'react';
import LienzoEcharts, { escaparHtml } from './LienzoEcharts';

// Componente reutilizable de mapa de calor.
// No asume qué dimensión va en cada eje: ejes y celdas llegan íntegramente desde la API por props.
// Maneja los estados: cargando, sin datos y error.
export default function GraficaMapaCalor({
  etiquetasHorizontal,
  etiquetasVertical,
  tituloHorizontal = '',
  tituloVertical = '',
  nombreMetrica = 'Valor',
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
    const maximoVisual = Math.max(maximo, minimo + 1);

    return {
      animationDurationUpdate: 320,
      tooltip: {
        position: 'top',
        confine: true,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (param) => {
          const val = Array.isArray(param.value) ? param.value : [];
          const etqX = escaparHtml(etiquetasHorizontal[val[0]] ?? '');
          const etqY = escaparHtml(etiquetasVertical[val[1]] ?? '');
          const cant =
            val[2] !== undefined ? Number(val[2]).toLocaleString('es-MX') : '0';
          return `<strong>${etqY} · ${etqX}</strong><br/>${escaparHtml(nombreMetrica)}: <strong>${cant}</strong>`;
        },
      },
      grid: {
        top: tituloVertical ? 26 : 16,
        right: 20,
        bottom: 64,
        left: 12,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        name: tituloHorizontal,
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#475569', fontSize: 11, fontWeight: 600 },
        data: etiquetasHorizontal,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: {
          color: '#475569',
          fontSize: 11,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'category',
        name: tituloVertical,
        nameTextStyle: { color: '#475569', fontSize: 11, fontWeight: 600 },
        data: etiquetasVertical,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#334155', fontSize: 11 },
      },
      visualMap: {
        min: minimo,
        max: maximoVisual,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 14,
        itemHeight: 130,
        inRange: {
          color: ['#f1f5f9', '#bfdbfe', '#3b82f6', '#1e3a8a'],
        },
        textStyle: { color: '#475569', fontSize: 11 },
      },
      series: [
        {
          name: nombreMetrica,
          type: 'heatmap',
          data: celdas,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowColor: 'rgba(15, 23, 42, 0.28)',
            },
          },
        },
      ],
    };
  }, [
    celdas,
    etiquetasHorizontal,
    etiquetasVertical,
    nombreMetrica,
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
