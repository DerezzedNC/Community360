import { useCallback, useMemo, useState } from 'react';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
} from '../componentes/graficas';
import { useCatalogos } from '../contextos/ContextoCatalogos';
import useConsultaApi from '../hooks/useConsultaApi';
import useMetricasTiempoReal from '../hooks/useMetricasTiempoReal';
import {
  consultarMetricasActividad,
  consultarMetricasEstatus,
  consultarMetricasGeografia,
  consultarMetricasPlataformas,
  consultarMetricasTemas,
} from '../servicios/api';

const ESTILOS_ESTATUS = {
  activo: { nombre: 'Activo', color: '#10b981' },
  en_riesgo: { nombre: 'En riesgo', color: '#f59e0b' },
  inactivo: { nombre: 'Inactivo', color: '#64748b' },
};

const NOMBRES_DIA_SEMANA = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export default function PaginaDashboard() {
  const {
    cargandoCatalogos,
    errorCatalogos,
    obtenerNombreLegible,
  } = useCatalogos();

  const consultaEstatus = useConsultaApi(consultarMetricasEstatus);
  const consultaGeografia = useConsultaApi(consultarMetricasGeografia);
  const consultaPlataformas = useConsultaApi(consultarMetricasPlataformas);
  const consultaTemas = useConsultaApi(consultarMetricasTemas);
  const consultaActividad = useConsultaApi(consultarMetricasActividad);

  // Según docs/INDICADORES.md: al recibir metricas.actualizadas tras un alta, cambio o baja,
  // solo cambian resumen, plataformas, temas y actividad; estatus y geografía no cambian con el CRUD.
  const manejarCambioTiempoReal = useCallback(() => {
    consultaPlataformas.refrescarSilencioso();
    consultaTemas.refrescarSilencioso();
    consultaActividad.refrescarSilencioso();
  }, [consultaActividad, consultaPlataformas, consultaTemas]);

  const {
    conexionWs,
    resumen: r,
    ultimoEventoTs,
    avisoServicioResumen,
    esperaReconexionSeg,
    reconectarAhora,
  } = useMetricasTiempoReal(manejarCambioTiempoReal);

  const [nivelGeografia, setNivelGeografia] = useState('estados');
  const [vistaTemas, setVistaTemas] = useState('interacciones');

  const esperandoNombresCatalogo = cargandoCatalogos && !errorCatalogos;

  const datosDonaEstatus = useMemo(() => {
    const filas = consultaEstatus.datos?.datos;
    const total = Number(consultaEstatus.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return [];
    }
    return filas.map((fila) => {
      const meta = ESTILOS_ESTATUS[fila.estatus] || {
        nombre: fila.estatus,
        color: undefined,
      };
      return {
        nombre: meta.nombre,
        valor: fila.usuarios,
        porcentaje: fila.porcentaje,
        color: meta.color,
      };
    });
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

    const ordenadaVisual = [...lista].reverse();
    const categorias = ordenadaVisual.map((item) =>
      nivelGeografia === 'ciudades'
        ? `${item.ciudad}, ${item.estado}`
        : `${item.estado} (${item.pais})`
    );
    const valores = ordenadaVisual.map((item) => item.usuarios);
    const alturaCalculada = `${Math.max(300, ordenadaVisual.length * 30 + 64)}px`;

    return {
      categorias,
      series: [
        {
          nombre: 'Usuarios con consentimiento',
          datos: valores,
          color: '#2563eb',
        },
      ],
      altura: alturaCalculada,
    };
  }, [consultaGeografia.datos, nivelGeografia]);

  const configuracionPlataformas = useMemo(() => {
    const filas = consultaPlataformas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [] };
    }

    return {
      categorias: filas.map((fila) =>
        obtenerNombreLegible('plataforma', fila.plataforma)
      ),
      series: [
        {
          nombre: 'Usuarios en padrón',
          datos: filas.map((fila) => fila.usuarios),
          color: '#2563eb',
        },
        {
          nombre: 'Interacciones',
          datos: filas.map((fila) => fila.interacciones),
          color: '#0ea5e9',
        },
      ],
    };
  }, [consultaPlataformas.datos, obtenerNombreLegible]);

  const configuracionTemas = useMemo(() => {
    const filas = consultaTemas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return {
        categorias: [],
        series: [],
        sinSentimiento: 0,
        decimales: null,
        tituloEje: 'Interacciones',
      };
    }

    if (vistaTemas === 'sentimiento') {
      const conDatos = filas.filter(
        (fila) =>
          fila.sentimiento_promedio !== null &&
          fila.sentimiento_promedio !== undefined
      );
      const ordenada = [...conDatos].reverse();
      return {
        categorias: ordenada.map((fila) =>
          obtenerNombreLegible('tema', fila.tema)
        ),
        series: [
          {
            nombre: 'Sentimiento promedio',
            datos: ordenada.map((fila) => fila.sentimiento_promedio),
            color: '#6366f1',
          },
        ],
        sinSentimiento: filas.length - conDatos.length,
        decimales: 3,
        tituloEje: 'Promedio (-1 a 1)',
      };
    }

    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((fila) =>
        obtenerNombreLegible('tema', fila.tema)
      ),
      series: [
        {
          nombre: 'Interacciones',
          datos: ordenada.map((fila) => fila.interacciones),
          color: '#0ea5e9',
        },
      ],
      sinSentimiento: 0,
      decimales: null,
      tituloEje: 'Interacciones',
    };
  }, [consultaTemas.datos, obtenerNombreLegible, vistaTemas]);

  const configuracionActividad = useMemo(() => {
    const celdasApi = consultaActividad.datos?.datos;
    if (!Array.isArray(celdasApi) || celdasApi.length === 0) {
      return {
        etiquetasHorizontal: [],
        etiquetasVertical: [],
        celdas: [],
        tituloHorizontal: '',
      };
    }

    const horasUnicas = Array.from(
      new Set(celdasApi.map((celda) => celda.hora))
    ).sort((a, b) => a - b);

    const diasUnicos = Array.from(
      new Set(celdasApi.map((celda) => celda.dia_semana))
    ).sort((a, b) => b - a);

    const indiceHora = new Map(horasUnicas.map((h, i) => [h, i]));
    const indiceDia = new Map(diasUnicos.map((d, i) => [d, i]));

    const etiquetasHorizontal = horasUnicas.map(
      (h) => `${String(h).padStart(2, '0')}:00`
    );
    const etiquetasVertical = diasUnicos.map(
      (d) => NOMBRES_DIA_SEMANA[d] || String(d)
    );

    const celdas = celdasApi
      .filter((c) => indiceHora.has(c.hora) && indiceDia.has(c.dia_semana))
      .map((c) => [
        indiceHora.get(c.hora),
        indiceDia.get(c.dia_semana),
        c.interacciones,
      ]);

    const zona = consultaActividad.datos?.zona_horaria || 'UTC';

    return {
      etiquetasHorizontal,
      etiquetasVertical,
      celdas,
      tituloHorizontal: `Hora del día (${zona})`,
    };
  }, [consultaActividad.datos]);

  const claseEstadoWs =
    conexionWs === 'conectado'
      ? 'insignia-ws--conectado'
      : conexionWs === 'origen_rechazado'
        ? 'insignia-ws--error'
        : 'insignia-ws--reconectando';

  const textoEstadoWs =
    conexionWs === 'conectado'
      ? 'Tiempo real activo'
      : conexionWs === 'origen_rechazado'
        ? 'Origen rechazado (4403)'
        : conexionWs === 'reconectando'
          ? esperaReconexionSeg > 0
            ? `Reconectando en ${esperaReconexionSeg} s…`
            : 'Reconectando canal…'
          : 'Conectando tiempo real…';

  return (
    <div className="rejilla-dashboard">
      <TarjetaSeccion
        id="seccion-resumen"
        titulo="Resumen de indicadores"
        descripcion="Indicadores en vivo recibidos por WebSocket al conectar y tras cada alta, cambio o baja de interacciones."
        rutaApi="WS /ws/metricas"
        anchoCompleto
      >
        <div className="barra-estado-ws">
          <div
            className={`insignia-ws ${claseEstadoWs}`}
            role="status"
            aria-live="polite"
          >
            <span className="insignia-ws__punto" aria-hidden="true" />
            <span>{textoEstadoWs}</span>
          </div>

          {(conexionWs === 'reconectando' ||
            conexionWs === 'origen_rechazado') && (
            <button
              type="button"
              className="boton-secundario"
              onClick={reconectarAhora}
            >
              Reconectar ahora
            </button>
          )}
        </div>

        {avisoServicioResumen && r && (
          <div className="aviso-servicio-ws" role="alert">
            <span>
              <strong>{avisoServicioResumen}.</strong> Se conserva en pantalla
              el último corte válido recibido.
            </span>
          </div>
        )}

        {r ? (
          <>
            <div className="rejilla-kpis">
              <div className="tarjeta-kpi">
                <p className="tarjeta-kpi__etiqueta">Usuarios en padrón</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.usuarios).toLocaleString('es-MX')}
                </p>
              </div>
              <div className="tarjeta-kpi">
                <p className="tarjeta-kpi__etiqueta">Usuarios activos</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.usuarios_activos).toLocaleString('es-MX')}
                </p>
                <p className="tarjeta-kpi__subtexto">
                  {Number(r.porcentaje_activos).toFixed(1)}% del total
                </p>
              </div>
              <div className="tarjeta-kpi">
                <p className="tarjeta-kpi__etiqueta">Con consentimiento</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.usuarios_con_consentimiento).toLocaleString('es-MX')}
                </p>
              </div>
              <div className="tarjeta-kpi tarjeta-kpi--dinamica">
                <p className="tarjeta-kpi__etiqueta">Interacciones</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.interacciones).toLocaleString('es-MX')}
                </p>
                <p className="tarjeta-kpi__subtexto">En tiempo real</p>
              </div>
              <div className="tarjeta-kpi tarjeta-kpi--dinamica">
                <p className="tarjeta-kpi__etiqueta">Usuarios que interactúan</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.usuarios_que_interactuan).toLocaleString('es-MX')}
                </p>
                <p className="tarjeta-kpi__subtexto">En tiempo real</p>
              </div>
              <div className="tarjeta-kpi tarjeta-kpi--dinamica">
                <p className="tarjeta-kpi__etiqueta">Sentimiento promedio</p>
                <p className="tarjeta-kpi__valor">
                  {r.sentimiento_promedio !== null &&
                  r.sentimiento_promedio !== undefined
                    ? Number(r.sentimiento_promedio).toFixed(3)
                    : 'Sin datos'}
                </p>
                <p className="tarjeta-kpi__subtexto">Escala -1 a 1</p>
              </div>
              <div className="tarjeta-kpi">
                <p className="tarjeta-kpi__etiqueta">En cuarentena</p>
                <p className="tarjeta-kpi__valor">
                  {Number(r.en_cuarentena).toLocaleString('es-MX')}
                </p>
              </div>
            </div>
            {(r.generado_en || ultimoEventoTs) && (
              <p className="nota-pie-resumen">
                Corte generado en UTC:{' '}
                <code>{r.generado_en || ultimoEventoTs}</code>
              </p>
            )}
          </>
        ) : avisoServicioResumen || conexionWs === 'origen_rechazado' ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">
              Resumen en tiempo real no disponible
            </p>
            <p className="estado-grafica__texto">
              {avisoServicioResumen ||
                'No fue posible establecer el canal en tiempo real.'}
            </p>
            <button
              type="button"
              className="boton-secundario"
              onClick={reconectarAhora}
            >
              Reintentar conexión
            </button>
          </div>
        ) : (
          <div className="estado-grafica" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <p className="estado-grafica__texto">
              Esperando resumen inicial por WebSocket…
            </p>
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-estatus"
        titulo="Usuarios por estatus"
        descripcion="Distribución histórica del padrón según los días desde su última actividad registrada."
        rutaApi="GET /api/metricas/estatus"
      >
        {consultaEstatus.datos &&
          !consultaEstatus.cargando &&
          !consultaEstatus.error && (
            <p className="nota-metrica">
              Total en padrón:{' '}
              <strong>
                {Number(consultaEstatus.datos.total).toLocaleString('es-MX')}
              </strong>{' '}
              usuarios
            </p>
          )}
        <GraficaDona
          datos={datosDonaEstatus}
          nombreSerie="Usuarios"
          altura="310px"
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
                Con ubicación:{' '}
                <strong>
                  {Number(
                    consultaGeografia.datos.usuarios_con_ubicacion
                  ).toLocaleString('es-MX')}
                </strong>{' '}
                · Se omiten grupos menores a{' '}
                <strong>{consultaGeografia.datos.minimo_por_grupo}</strong>{' '}
                usuarios
              </p>
              <div
                className="grupo-conmutador"
                role="group"
                aria-label="Nivel de agrupación geográfica"
              >
                <button
                  type="button"
                  className={`boton-conmutador ${
                    nivelGeografia === 'estados'
                      ? 'boton-conmutador--activo'
                      : ''
                  }`}
                  onClick={() => setNivelGeografia('estados')}
                >
                  Estados
                </button>
                <button
                  type="button"
                  className={`boton-conmutador ${
                    nivelGeografia === 'ciudades'
                      ? 'boton-conmutador--activo'
                      : ''
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
            tituloEjeValores="Usuarios"
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
        descripcion="Comparativa entre usuarios registrados en TiDB e interacciones dinámicas en Capella por plataforma."
        rutaApi="GET /api/metricas/plataformas"
      >
        <GraficaBarras
          categorias={configuracionPlataformas.categorias}
          series={configuracionPlataformas.series}
          mostrarLeyenda
          tituloEjeValores="Cantidad"
          altura="330px"
          cargando={consultaPlataformas.cargando || esperandoNombresCatalogo}
          error={consultaPlataformas.error}
          alReintentar={consultaPlataformas.reintentar}
          etiquetaAria="Usuarios e interacciones por plataforma"
        />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-temas"
        titulo="Temas"
        descripcion="Volumen dinámico de interacciones y sentimiento promedio agrupados por tema del catálogo."
        rutaApi="GET /api/metricas/temas"
      >
        {consultaTemas.datos &&
          !consultaTemas.cargando &&
          !consultaTemas.error && (
            <div className="barra-controles-seccion">
              <p className="nota-metrica">
                {vistaTemas === 'sentimiento' &&
                configuracionTemas.sinSentimiento > 0
                  ? `${configuracionTemas.sinSentimiento} tema(s) sin interacciones omitidos del promedio`
                  : 'Nombres traducidos desde el catálogo de temas'}
              </p>
              <div
                className="grupo-conmutador"
                role="group"
                aria-label="Métrica de temas"
              >
                <button
                  type="button"
                  className={`boton-conmutador ${
                    vistaTemas === 'interacciones'
                      ? 'boton-conmutador--activo'
                      : ''
                  }`}
                  onClick={() => setVistaTemas('interacciones')}
                >
                  Interacciones
                </button>
                <button
                  type="button"
                  className={`boton-conmutador ${
                    vistaTemas === 'sentimiento'
                      ? 'boton-conmutador--activo'
                      : ''
                  }`}
                  onClick={() => setVistaTemas('sentimiento')}
                >
                  Sentimiento
                </button>
              </div>
            </div>
          )}

        <GraficaBarras
          categorias={configuracionTemas.categorias}
          series={configuracionTemas.series}
          horizontal
          decimales={configuracionTemas.decimales}
          tituloEjeValores={configuracionTemas.tituloEje}
          altura="330px"
          cargando={consultaTemas.cargando || esperandoNombresCatalogo}
          error={consultaTemas.error}
          alReintentar={consultaTemas.reintentar}
          etiquetaAria="Métricas por tema"
        />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-actividad"
        titulo="Actividad por día y hora"
        descripcion="Mapa de calor dinámico de interacciones agrupadas por día de la semana y hora en UTC."
        rutaApi="GET /api/metricas/actividad"
        anchoCompleto
      >
        {consultaActividad.datos &&
          !consultaActividad.cargando &&
          !consultaActividad.error && (
            <p className="nota-metrica">
              Zona horaria del cálculo:{' '}
              <strong>{consultaActividad.datos.zona_horaria}</strong> · Se
              actualiza automáticamente ante altas, cambios o bajas
            </p>
          )}
        <div className="contenedor-mapa-calor">
          <div className="contenedor-mapa-calor__interno">
            <GraficaMapaCalor
              etiquetasHorizontal={configuracionActividad.etiquetasHorizontal}
              etiquetasVertical={configuracionActividad.etiquetasVertical}
              tituloHorizontal={configuracionActividad.tituloHorizontal}
              tituloVertical="Día"
              nombreMetrica="Interacciones"
              celdas={configuracionActividad.celdas}
              altura="360px"
              cargando={consultaActividad.cargando}
              error={consultaActividad.error}
              alReintentar={consultaActividad.reintentar}
              etiquetaAria="Mapa de calor de actividad por día y hora en UTC"
            />
          </div>
        </div>
      </TarjetaSeccion>
    </div>
  );
}
