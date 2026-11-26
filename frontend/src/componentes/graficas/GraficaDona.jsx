import { useMemo } from 'react';
import LienzoEcharts, { PALETA_C360, escaparHtml } from './LienzoEcharts';

// Componente reutilizable de dona. Recibe arreglo [{ nombre, valor, porcentaje?, color? }] por props.
// Maneja los estados: cargando, sin datos y error.
export default function GraficaDona({
  datos,
  nombreSerie = '',
  altura = '300px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Gráfica de proporción en dona',
}) {
  const sinDatos = !Array.isArray(datos) || datos.length === 0;

  const opcion = useMemo(() => {
    if (sinDatos) {
      return null;
    }

    return {
      color: PALETA_C360,
      animationDurationUpdate: 320,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#f8fafc', fontSize: 12 },
        formatter: (param) => {
          const pct =
            typeof param.data?.porcentaje === 'number'
              ? param.data.porcentaje.toFixed(1)
              : param.percent;
          const cantidad = Number(param.value).toLocaleString('es-MX');
          return `<strong>${escaparHtml(param.name)}</strong><br/>${param.marker} ${escaparHtml(
            nombreSerie || 'Total'
          )}: <strong>${cantidad}</strong> (${pct}%)`;
        },
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: '#334155', fontSize: 12 },
      },
      series: [
        {
          name: nombreSerie,
          type: 'pie',
          radius: ['46%', '72%'],
          center: ['50%', '43%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
            borderRadius: 6,
          },
          label: {
            show: true,
            color: '#334155',
            fontSize: 11,
            edgeDistance: 10,
            bleedMargin: 6,
            formatter: (param) => {
              const pct =
                typeof param.data?.porcentaje === 'number'
                  ? param.data.porcentaje.toFixed(1)
                  : param.percent;
              return `${param.name}\n${pct}%`;
            },
          },
          labelLine: {
            length: 10,
            length2: 8,
          },
          data: datos.map((elemento) => ({
            name: elemento.nombre,
            value: elemento.valor,
            porcentaje: elemento.porcentaje,
            itemStyle: elemento.color ? { color: elemento.color } : undefined,
          })),
        },
      ],
    };
  }, [datos, nombreSerie, sinDatos]);

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
