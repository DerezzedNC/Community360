import { useMemo } from 'react';
import LienzoEcharts, { PALETA_C360 } from './LienzoEcharts';

// Componente reutilizable de dona. Recibe arreglo [{ nombre, valor }] por props.
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
      tooltip: {
        trigger: 'item',
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#475569', fontSize: 12 },
      },
      series: [
        {
          name: nombreSerie,
          type: 'pie',
          radius: ['48%', '74%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
            borderRadius: 6,
          },
          label: {
            show: true,
            color: '#334155',
            fontSize: 12,
          },
          data: datos.map((elemento) => ({
            name: elemento.nombre,
            value: elemento.valor,
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
