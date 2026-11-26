import TarjetaSeccion from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
} from '../componentes/graficas';

export default function PaginaDashboard() {
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
        pendienteConexion
      >
        <GraficaDona datos={null} />
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
        id="seccion-geografia"
        titulo="Geografía"
        descripcion="Distribución por estado y ciudad calculada únicamente sobre cuentas que otorgaron consentimiento de datos."
        rutaApi="GET /api/metricas/geografia"
        insigniaPrivacidad="Solo con consentimiento"
        pendienteConexion
      >
        <GraficaBarras categorias={null} series={null} horizontal />
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
