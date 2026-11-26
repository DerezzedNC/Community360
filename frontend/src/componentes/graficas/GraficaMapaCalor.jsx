import { useMemo } from 'react';
import LienzoEcharts from './LienzoEcharts';
import { escaparHtml, tooltipBase, useTemaGraficas } from './temaGraficas';

// Mapa de calor reutilizable. Ejes y celdas llegan íntegros por props desde la API.
export default function GraficaMapaCalor({
  etiquetasHorizontal,
  etiquetasVertical,
  tituloHorizontal = '',
  nombreMetrica = 'Valor',
  celdas,
  altura = '340px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Mapa de calor',
  tabla = null,
}) {
  const tema = useTemaGraficas();
  const tieneHorizontal = Array.isArray(etiquetasHorizontal) && etiquetasHorizontal.length > 0;
  const tieneVertical = Array.isArray(etiquetasVertical) && etiquetasVertical.length > 0;
  const tieneCeldas = Array.isArray(celdas) && celdas.length > 0;
  const sinDatos = !tieneHorizontal || !tieneVertical || !tieneCeldas;

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    let maximo = 0;
    for (const celda of celdas) {
      const valor = Array.isArray(celda) ? Number(celda[2]) : NaN;
      if (Number.isFinite(valor) && valor > maximo) maximo = valor;
    }

    const etiquetaEje = { color: tema.texto2, fontSize: 12, fontFamily: tema.fuente };

    return {
      animation: tema.animacion,
      animationDurationUpdate: tema.duracion,
      textStyle: { fontFamily: tema.fuente },
      tooltip: {
        ...tooltipBase(tema),
        position: 'top',
        formatter: (param) => {
          const val = Array.isArray(param.value) ? param.value : [];
          const etqX = escaparHtml(etiquetasHorizontal[val[0]] ?? '');
          const etqY = escaparHtml(etiquetasVertical[val[1]] ?? '');
          const cant = val[2] !== undefined ? Number(val[2]).toLocaleString('es-MX') : '0';
          return `<strong>${etqY}, ${etqX}</strong><br/>${escaparHtml(nombreMetrica)}: <strong>${cant}</strong>`;
        },
      },
      grid: { top: 4, right: 4, bottom: 72, left: 0, containLabel: true },
      xAxis: {
        type: 'category',
        name: tituloHorizontal,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: etiquetaEje,
        data: etiquetasHorizontal,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { ...etiquetaEje, hideOverlap: true },
      },
      yAxis: {
        type: 'category',
        data: etiquetasVertical,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: etiquetaEje,
      },
      visualMap: {
        // Las celdas en 0 quedan fuera de la gama y se pintan como celda vacía
        min: 1,
        max: Math.max(maximo, 2),
        calculable: false,
        orient: 'horizontal',
        left: 0,
        bottom: 0,
        itemWidth: 12,
        itemHeight: 160,
        precision: 0,
        text: ['Más', 'Menos'],
        inRange: { color: tema.gamaCalor },
        outOfRange: { color: tema.relleno },
        textStyle: etiquetaEje,
      },
      series: [
        {
          name: nombreMetrica,
          type: 'heatmap',
          data: celdas,
          itemStyle: {
            borderColor: tema.superficie, // separador de 2 px del color de la superficie
            borderWidth: 2,
            borderRadius: 4,
          },
          emphasis: { itemStyle: { borderColor: tema.texto, borderWidth: 2 } },
        },
      ],
    };
  }, [celdas, etiquetasHorizontal, etiquetasVertical, nombreMetrica, sinDatos, tema, tituloHorizontal]);

  return (
    <LienzoEcharts
      opcion={opcion}
      altura={altura}
      cargando={cargando}
      error={error}
      sinDatos={sinDatos}
      alReintentar={alReintentar}
      etiquetaAria={etiquetaAria}
      forma="calor"
      tabla={tabla}
    />
  );
}
