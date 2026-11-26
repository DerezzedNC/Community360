import { useMemo, useState } from 'react';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
} from '../componentes/graficas';
import useConsultaApi from '../hooks/useConsultaApi';
import {
  consultarMetricasEstatus,
  consultarMetricasGeografia,
} from '../servicios/api';

const NOMBRES_ESTATUS = {
  activo: 'Activo',
  en_riesgo: 'En riesgo',
  inactivo: 'Inactivo',
};

export default function PaginaDashboard() {
  const consultaEstatus = useConsultaApi(consultarMetricasEstatus);
  const consultaGeografia = useConsultaApi(consultarMetricasGeografia);
  const [nivelGeografia, setNivelGeografia] = useState('estados');

  const datosDonaEstatus = useMemo(() => {
    const filas = consultaEstatus.datos?.datos;
    const total = Number(consultaEstatus.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return [];
    }
    return filas.map((fila) => ({
      nombre: `${NOMBRES_ESTATUS[fila.estatus] || fila.estatus} (${fila.porcentaje}%)`,
      valor: fila.usuarios,
    }));
  }, [consultaEstatus.datos]);

  const configuracionGeografia = useMemo(() => {
    const datosGeo = consultaGeografia.datos;
    if (!datosGeo) {
      return { categorias: [], series: [], altura: '300px' };
    }

    const lista =
      nivelGeografia === 'ciudades'
        ? Array.isArray(datosGeo.ciudades)
          ? datosGeo.ciudades
          : []
        : Array.isArray(datosGeo.estados)
          ? datosGeo.estados
          : [];

    if (lista.length === 0) {
      return { categorias: [], series: [], altura: '300px' };
    }

    // Se invierte para que en barras horizontales el mayor quede arriba
    const ordenadaVisual = [...lista].reverse();
    const categorias = ordenadaVisual.map((item) =>
      nivelGeografia === 'ciudades'
        ? `${item.ciudad}, ${item.estado}`
        : `${item.estado} (${item.pais})`
    );
    const valores = ordenadaVisual.map((item) => item.usuarios);
    const alturaCalculada = `${Math.max(300, ordenadaVisual.length * 30 + 60)}px`;

    return {
      categorias,
      series: [{ nombre: 'Usuarios con consentimiento', datos: valores }],
      altura: alturaCalculada,
    };
  }, [consultaGeografia.datos, nivelGeografia]);

  return (
    <div className="rejilla-dashboard">
      <TarjetaSeccion
        id="seccion-resumen"
        titulo="Resumen de indicadores"
        descripcion="Totales e indicadores principales de la comunidad virtual definidos en el contrato analítico."
        rutaApi="GET /api/metricas/resumen"
        anchoCompleto
        pendienteConexion
      />

      <TarjetaSeccion
        id="seccion-estatus"
        titulo="Usuarios por estatus"
        descripcion="Distribución de cuentas según su estatus operativo en el padrón."
        rutaApi="GET /api/metricas/estatus"
      >
        {consultaEstatus.datos && !consultaEstatus.cargando && !consultaEstatus.error && (
          <p className="nota-metrica">
            Total en padrón: <strong>{consultaEstatus.datos.total}</strong> usuarios
          </p>
        )}
        <GraficaDona
          datos={datosDonaEstatus}
          nombreSerie="Usuarios"
          cargando={consultaEstatus.cargando}
          error={consultaEstatus.error}
          alReintentar={consultaEstatus.reintentar}
          etiquetaAria="Distribución de usuarios por estatus"
        />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-geografia"
        titulo="Geografía"
        descripcion="Distribución por estado y ciudad calculada únicamente sobre cuentas que otorgaron consentimiento de datos."
        rutaApi="GET /api/metricas/geografia"
        insigniaPrivacidad="Solo con consentimiento"
      >
        {consultaGeografia.datos &&
          !consultaGeografia.cargando &&
          !consultaGeografia.error && (
            <div className="barra-controles-seccion">
              <p className="nota-metrica">
                Con ubicación: <strong>{consultaGeografia.datos.usuarios_con_ubicacion}</strong>{' '}
                · Se omiten grupos menores a{' '}
                <strong>{consultaGeografia.datos.minimo_por_grupo}</strong> usuarios
              </p>
              <div
                className="grupo-conmutador"
                role="group"
                aria-label="Nivel de agrupación geográfica"
              >
                <button
                  type="button"
                  className={`boton-conmutador ${
                    nivelGeografia === 'estados' ? 'boton-conmutador--activo' : ''
                  }`}
                  onClick={() => setNivelGeografia('estados')}
                >
                  Estados
                </button>
                <button
                  type="button"
                  className={`boton-conmutador ${
                    nivelGeografia === 'ciudades' ? 'boton-conmutador--activo' : ''
                  }`}
                  onClick={() => setNivelGeografia('ciudades')}
                >
                  Ciudades
                </button>
              </div>
            </div>
          )}

        <div className="contenedor-grafica-scroll">
          <GraficaBarras
            categorias={configuracionGeografia.categorias}
            series={configuracionGeografia.series}
            horizontal
            altura={configuracionGeografia.altura}
            cargando={consultaGeografia.cargando}
            error={consultaGeografia.error}
            alReintentar={consultaGeografia.reintentar}
            etiquetaAria="Usuarios con consentimiento por ubicación"
          />
        </div>
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-plataformas"
        titulo="Plataformas"
        descripcion="Comparativa de usuarios registrados e interacciones por plataforma."
        rutaApi="GET /api/metricas/plataformas"
        pendienteConexion
      >
        <GraficaBarras categorias={null} series={null} />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-temas"
        titulo="Temas"
        descripcion="Volumen de interacciones y sentimiento promedio agrupados por tema."
        rutaApi="GET /api/metricas/temas"
        pendienteConexion
      >
        <GraficaBarras categorias={null} series={null} />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-actividad"
        titulo="Actividad"
        descripcion="Mapa de calor de interacciones cuyos ejes provienen directamente de la API."
        rutaApi="GET /api/metricas/actividad"
        anchoCompleto
        pendienteConexion
      >
        <GraficaMapaCalor
          etiquetasHorizontal={null}
          etiquetasVertical={null}
          celdas={null}
        />
      </TarjetaSeccion>
    </div>
  );
}
