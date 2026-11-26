import { useEffect, useMemo, useRef, useState } from 'react';
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
  gama = null, // colores de menos a más; por omisión, la gama azul
}) {
  const tema = useTemaGraficas();
  const anteriorRef = useRef(null);
  const [resaltar, setResaltar] = useState(null);
  const tieneHorizontal = Array.isArray(etiquetasHorizontal) && etiquetasHorizontal.length > 0;
  const tieneVertical = Array.isArray(etiquetasVertical) && etiquetasVertical.length > 0;
  const tieneCeldas = Array.isArray(celdas) && celdas.length > 0;
  const sinDatos = !tieneHorizontal || !tieneVertical || !tieneCeldas;

  // Celdas cuyo valor cambió respecto a los datos anteriores (se iluminan 1.5 s)
  useEffect(() => {
    if (sinDatos) return;
    const clave = (celda) => `${etiquetasHorizontal[celda[0]]}|${etiquetasVertical[celda[1]]}`;
    const actual = new Map(celdas.map((celda) => [clave(celda), Number(celda[2])]));
    const anterior = anteriorRef.current;
    anteriorRef.current = actual;
    if (!anterior) return;
    const cambios = [];
    celdas.forEach((celda, dataIndex) => {
      const k = clave(celda);
      if (anterior.has(k) && anterior.get(k) !== Number(celda[2])) cambios.push({ seriesIndex: 0, dataIndex });
    });
    if (cambios.length > 0) setResaltar(cambios);
  }, [celdas, etiquetasHorizontal, etiquetasVertical, sinDatos]);

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    let maximo = 0;
    for (const celda of celdas) {
      const valor = Array.isArray(celda) ? Number(celda[2]) : NaN;
      if (Number.isFinite(valor) && valor > maximo) maximo = valor;
    }
    // La celda máxima (la primera si empatan) lleva contorno y su valor a la vista
    const indiceMaximo = maximo > 0 ? celdas.findIndex((celda) => Number(celda[2]) === maximo) : -1;
    const datosSerie = celdas.map((celda, i) =>
      i === indiceMaximo
        ? {
            value: celda,
            itemStyle: { borderColor: tema.texto, borderWidth: 2 },
            // En una pastilla de superficie: legible sobre cualquier color de la gama
            label: {
              show: true,
              color: tema.texto,
              backgroundColor: tema.superficie,
              padding: [2, 6],
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              formatter: () => maximo.toLocaleString('es-MX'),
            },
          }
        : celda
    );

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
        inRange: { color: gama || tema.gamaCalor },
        outOfRange: { color: tema.relleno },
        textStyle: etiquetaEje,
      },
      series: [
        {
          name: nombreMetrica,
          type: 'heatmap',
          data: datosSerie,
          itemStyle: {
            borderColor: tema.superficie, // separador de 2 px del color de la superficie
            borderWidth: 2,
            borderRadius: 4,
          },
          emphasis: {
            itemStyle: {
              borderColor: tema.texto,
              borderWidth: 2,
              shadowBlur: 14,
              shadowColor: tema.oscuro ? 'rgba(255,255,255,0.5)' : 'rgba(0,113,227,0.5)',
            },
          },
        },
      ],
    };
  }, [celdas, etiquetasHorizontal, etiquetasVertical, gama, nombreMetrica, sinDatos, tema, tituloHorizontal]);

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
      resaltar={resaltar}
    />
  );
}
