import { useEffect, useMemo, useRef, useState } from 'react';
import LienzoEcharts, { compararSeries, fotografiarSeries } from './LienzoEcharts';
import { escaparHtml, tooltipBase, useTemaGraficas } from './temaGraficas';

const CENTRO_VERTICAL = '58%';

// Dona reutilizable. Recibe [{ nombre, valor, porcentaje?, color? }] y el total para el centro.
export default function GraficaDona({
  datos,
  nombreSerie = '',
  total = null,
  leyendaTotal = '',
  altura = '300px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Gráfica de dona',
  tabla = null,
  fuente = '',
}) {
  const tema = useTemaGraficas();
  const sinDatos = !Array.isArray(datos) || datos.length === 0;
  const anteriorRef = useRef(null);
  const [resaltar, setResaltar] = useState(null);

  // Qué segmentos cambiaron respecto a los datos anteriores (para iluminarlos 1.5 s)
  useEffect(() => {
    if (sinDatos) return;
    const categorias = datos.map((e) => e.nombre);
    const series = [{ nombre: 'dona', datos: datos.map((e) => e.valor) }];
    const cambios = compararSeries(anteriorRef.current, categorias, series);
    anteriorRef.current = fotografiarSeries(categorias, series);
    if (cambios && cambios.length > 0) setResaltar(cambios);
  }, [datos, sinDatos]);

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    const porcentajeDe = (param) =>
      typeof param.data?.porcentaje === 'number' ? param.data.porcentaje.toFixed(1) : param.percent;

    return {
      animation: tema.animacion,
      animationDurationUpdate: tema.duracion,
      textStyle: { fontFamily: tema.fuente },
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'item',
        formatter: (param) =>
          `<strong>${escaparHtml(param.name)}</strong><br/>${param.marker} ${escaparHtml(
            nombreSerie || 'Total'
          )}: <strong>${Number(param.value).toLocaleString('es-MX')}</strong> (${porcentajeDe(param)} %)`,
      },
      legend: {
        top: 0,
        left: 0,
        icon: 'circle', // leyenda en varias líneas: nada queda oculto tras flechas
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        textStyle: { color: tema.texto, fontSize: 12, fontFamily: tema.fuente },
      },
      series: [
        {
          name: nombreSerie,
          type: 'pie',
          radius: ['44%', '63%'],
          center: ['50%', CENTRO_VERTICAL],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: tema.superficie, // separador de 2 px del color de la superficie
            borderWidth: 2,
          },
          label: {
            show: true,
            color: tema.texto,
            fontSize: 12,
            lineHeight: 16,
            fontFamily: tema.fuente,
            formatter: (param) => `${param.name}\n${porcentajeDe(param)} %`,
          },
          labelLine: { length: 8, length2: 8, lineStyle: { color: tema.texto2 } },
          emphasis: { scale: !tema.reducirMovimiento, scaleSize: 4 },
          data: datos.map((elemento) => ({
            name: elemento.nombre,
            value: elemento.valor,
            porcentaje: elemento.porcentaje,
            itemStyle: elemento.color ? { color: elemento.color } : undefined,
          })),
        },
      ],
    };
  }, [datos, nombreSerie, sinDatos, tema]);

  const centro =
    total === null ? null : (
      // Centrado sobre el hueco de la dona (no sobre el bloque, que incluye "Ver datos")
      <div className="dona-centro" style={{ top: `calc(${altura} * ${parseFloat(CENTRO_VERTICAL) / 100})` }} aria-hidden="true">
        <span className="dona-centro__numero">{Number(total).toLocaleString('es-MX')}</span>
        {leyendaTotal && <span className="dona-centro__leyenda">{leyendaTotal}</span>}
      </div>
    );

  return (
    <div className="envoltorio-dona">
      <LienzoEcharts
        opcion={opcion}
        altura={altura}
        cargando={cargando}
        error={error}
        sinDatos={sinDatos}
        alReintentar={alReintentar}
        etiquetaAria={etiquetaAria}
        forma="dona"
        tabla={tabla}
        fuente={fuente}
        resaltar={resaltar}
      />
      {!cargando && !error && !sinDatos && centro}
    </div>
  );
}
