import { useCallback, useEffect, useMemo, useState } from 'react';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
  MapaPuntosCalientes,
} from '../componentes/graficas';
import { useCatalogos } from '../contextos/ContextoCatalogos';
import useConsultaApi from '../hooks/useConsultaApi';
import useMetricasTiempoReal from '../hooks/useMetricasTiempoReal';
import {
  consultarMetricasActividad,
  consultarMetricasDemografia,
  consultarMetricasEstatus,
  consultarMetricasEtiquetas,
  consultarMetricasGeografia,
  consultarMetricasPlataformas,
  consultarMetricasTemas,
  consultarMetricasTipos,
  consultarPuntosCalientes,
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

const ETIQUETAS_CAMBIO = {
  creada: 'Interacción creada',
  editada: 'Interacción editada',
  borrada: 'Interacción borrada',
};

function formatearTiempoRelativo(recibidoEnMs, ahoraMs) {
  const diferenciaSeg = Math.max(
    1,
    Math.round((ahoraMs - recibidoEnMs) / 1000)
  );
  if (diferenciaSeg < 60) {
    return `hace ${diferenciaSeg} s`;
  }
  const minutos = Math.floor(diferenciaSeg / 60);
  if (minutos < 60) {
    return `hace ${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h`;
}

function AvisoUltimoCambio({ cambio }) {
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());

  useEffect(() => {
    if (!cambio) {
      return undefined;
    }
    setAhoraMs(Date.now());
    let cancelado = false;
    let temporizador = null;

    function programarTick() {
      temporizador = window.setTimeout(() => {
        if (!cancelado) {
          setAhoraMs(Date.now());
          programarTick();
        }
      }, 1000);
    }

    programarTick();
    return () => {
      cancelado = true;
      if (temporizador !== null) {
        window.clearTimeout(temporizador);
      }
    };
  }, [cambio]);

  if (!cambio) {
    return null;
  }

  const etiquetaAccion =
    ETIQUETAS_CAMBIO[cambio.tipo] || `Interacción ${cambio.tipo}`;
  const claseTipo = `aviso-cambio-ws--${cambio.tipo}`;

  return (
    <div
      className={`aviso-cambio-ws ${claseTipo}`}
      role="status"
      aria-live="polite"
    >
      <span className="aviso-cambio-ws__punto" aria-hidden="true" />
      <span>
        <strong>{etiquetaAccion}</strong> ·{' '}
        <code className="aviso-cambio-ws__id">{cambio.id_interaccion}</code> ·{' '}
        {formatearTiempoRelativo(cambio.recibidoEnMs, ahoraMs)}
      </span>
    </div>
  );
}

export default function PaginaDashboard() {
  const {
    cargandoCatalogos,
    errorCatalogos,
    obtenerNombreLegible,
  } = useCatalogos();

  // Métricas de TiDB (no cambian con el CRUD de interacciones)
  const consultaEstatus = useConsultaApi(consultarMetricasEstatus);
  const consultaGeografia = useConsultaApi(consultarMetricasGeografia);
  const consultaPuntosCalientes = useConsultaApi(consultarPuntosCalientes);
  const consultaDemografia = useConsultaApi(consultarMetricasDemografia);

  // Métricas dinámicas que usan Capella (se refrescan con metricas.actualizadas)
  const consultaPlataformas = useConsultaApi(consultarMetricasPlataformas);
  const consultaTemas = useConsultaApi(consultarMetricasTemas);
  const consultaTipos = useConsultaApi(consultarMetricasTipos);
  const consultaEtiquetas = useConsultaApi(consultarMetricasEtiquetas);
  const consultaActividad = useConsultaApi(consultarMetricasActividad);

  // Según docs/INDICADORES.md: al recibir metricas.actualizadas se refrescan las métricas de Capella;
  // estatus, geografía, puntos-calientes y demografía no cambian con el CRUD.
  const manejarCambioTiempoReal = useCallback(() => {
    consultaPlataformas.refrescarSilencioso();
    consultaTemas.refrescarSilencioso();
    consultaTipos.refrescarSilencioso();
    consultaEtiquetas.refrescarSilencioso();
    consultaActividad.refrescarSilencioso();
  }, [
    consultaActividad,
    consultaEtiquetas,
    consultaPlataformas,
    consultaTemas,
    consultaTipos,
  ]);

  const {
    conexionWs,
    resumen: r,
    ultimoEventoTs,
    avisoServicioResumen,
    esperaReconexionSeg,
    ultimoCambio,
    solicitandoActualizacion,
    solicitarActualizacion,
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

  const datosDonaTipos = useMemo(() => {
    const filas = consultaTipos.datos?.datos;
    const total = Number(consultaTipos.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return [];
    }
    return filas.map((fila) => ({
      nombre: fila.nombre || fila.tipo,
      valor: fila.interacciones,
      porcentaje: fila.porcentaje,
    }));
  }, [consultaTipos.datos]);

  const configuracionEtiquetas = useMemo(() => {
    const filas = consultaEtiquetas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [] };
    }
    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((fila) => fila.nombre || fila.etiqueta),
      series: [
        {
          nombre: 'Interacciones con la etiqueta',
          datos: ordenada.map((fila) => fila.interacciones),
          color: '#14b8a6',
        },
      ],
    };
  }, [consultaEtiquetas.datos]);

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

  const configuracionDemografia = useMemo(() => {
    const demo = consultaDemografia.datos;
    if (!demo) {
      return {
        edadCategorias: [],
        edadSeries: [],
        interesCategorias: [],
        interesSeries: [],
        cruceHorizontal: [],
        cruceVertical: [],
        cruceCeldas: [],
      };
    }

    const rangos = Array.isArray(demo.rangos_edad) ? demo.rangos_edad : [];
    const intereses = Array.isArray(demo.intereses) ? demo.intereses : [];
    const cruce = Array.isArray(demo.cruce) ? demo.cruce : [];

    const edadCategorias = rangos.map((rItem) => rItem.descripcion || rItem.rango_edad);
    const edadSeries =
      rangos.length > 0
        ? [
            {
              nombre: 'Usuarios',
              datos: rangos.map((rItem) => rItem.usuarios),
              color: '#2563eb',
            },
          ]
        : [];

    const interesesOrdenados = [...intereses].sort(
      (a, b) => a.usuarios - b.usuarios
    );
    const interesCategorias = interesesOrdenados.map(
      (iItem) => iItem.nombre || iItem.interes
    );
    const interesSeries =
      interesesOrdenados.length > 0
        ? [
            {
              nombre: 'Usuarios',
              datos: interesesOrdenados.map((iItem) => iItem.usuarios),
              color: '#10b981',
            },
          ]
        : [];

    // Matriz completa rango_edad × interés (las combinaciones ausentes en cruce valen 0)
    const interesesVerticales = [...intereses].reverse();
    const mapaCruce = new Map();
    for (const fila of cruce) {
      mapaCruce.set(`${fila.rango_edad}|${fila.interes}`, fila.usuarios);
    }

    const cruceCeldas = [];
    if (rangos.length > 0 && interesesVerticales.length > 0) {
      for (let idxX = 0; idxX < rangos.length; idxX += 1) {
        for (let idxY = 0; idxY < interesesVerticales.length; idxY += 1) {
          const clave = `${rangos[idxX].rango_edad}|${interesesVerticales[idxY].interes}`;
          cruceCeldas.push([idxX, idxY, mapaCruce.get(clave) ?? 0]);
        }
      }
    }

    return {
      edadCategorias,
      edadSeries,
      interesCategorias,
      interesSeries,
      cruceHorizontal: edadCategorias,
      cruceVertical: interesesVerticales.map((iItem) => iItem.nombre || iItem.interes),
      cruceCeldas,
    };
  }, [consultaDemografia.datos]);

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

  const pc = consultaPuntosCalientes.datos;

  return (
    <div className="rejilla-dashboard">
      <TarjetaSeccion
        id="seccion-resumen"
        titulo="Resumen de indicadores"
        descripcion="Indicadores en vivo recibidos por WebSocket al conectar, bajo pedido manual y tras cada alta, cambio o baja de interacciones."
        rutaApi="WS /ws/metricas"
        anchoCompleto
      >
        <div className="barra-estado-ws">
          <div className="barra-estado-ws__izquierda">
            <div
              className={`insignia-ws ${claseEstadoWs}`}
              role="status"
              aria-live="polite"
            >
              <span className="insignia-ws__punto" aria-hidden="true" />
              <span>{textoEstadoWs}</span>
            </div>

            <AvisoUltimoCambio cambio={ultimoCambio} />
          </div>

          <div className="barra-estado-ws__derecha">
            {conexionWs === 'conectado' && (
              <button
                type="button"
                className="boton-actualizar-ws"
                onClick={solicitarActualizacion}
                disabled={solicitandoActualizacion}
              >
                {solicitandoActualizacion
                  ? 'Actualizando…'
                  : 'Actualizar en vivo'}
              </button>
            )}

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
        titulo="Geografía por estado y ciudad"
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
        id="seccion-puntos-calientes"
        titulo="Mapa de calor geográfico (puntos calientes)"
        descripcion="Densidad geográfica agregada en cuadrícula sobre OpenStreetMap. Nunca expone coordenadas individuales ni interpola a nivel calle o colonia."
        rutaApi="GET /api/metricas/puntos-calientes"
        insigniaPrivacidad="Solo con consentimiento · cuadros de 0.2° con 3 usuarios o más"
        anchoCompleto
      >
        {pc &&
          !consultaPuntosCalientes.cargando &&
          !consultaPuntosCalientes.error && (
            <p className="nota-metrica">
              Visibles en mapa:{' '}
              <strong>
                {Number(pc.usuarios_en_mapa).toLocaleString('es-MX')}
              </strong>{' '}
              de{' '}
              <strong>
                {Number(pc.usuarios_con_coordenadas).toLocaleString('es-MX')}
              </strong>{' '}
              usuarios con coordenadas y consentimiento ({pc.datos?.length ?? 0}{' '}
              cuadros de {pc.tamano_cuadro}° con {pc.minimo_por_cuadro} o más
              usuarios)
            </p>
          )}
        <MapaPuntosCalientes
          datos={pc?.datos ?? null}
          tamanoCuadro={pc?.tamano_cuadro ?? 0.2}
          altura="410px"
          cargando={consultaPuntosCalientes.cargando}
          error={consultaPuntosCalientes.error}
          alReintentar={consultaPuntosCalientes.reintentar}
        />
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
        id="seccion-tipos"
        titulo="Interacciones por tipo"
        descripcion="Proporción dinámica de interacciones según el catálogo de tipos de interacción."
        rutaApi="GET /api/metricas/tipos"
      >
        {consultaTipos.datos &&
          !consultaTipos.cargando &&
          !consultaTipos.error && (
            <p className="nota-metrica">
              Total contabilizado:{' '}
              <strong>
                {Number(consultaTipos.datos.total).toLocaleString('es-MX')}
              </strong>{' '}
              interacciones
            </p>
          )}
        <GraficaDona
          datos={datosDonaTipos}
          nombreSerie="Interacciones"
          altura="320px"
          cargando={consultaTipos.cargando}
          error={consultaTipos.error}
          alReintentar={consultaTipos.reintentar}
          etiquetaAria="Proporción de interacciones por tipo"
        />
      </TarjetaSeccion>

      <TarjetaSeccion
        id="seccion-etiquetas"
        titulo="Etiquetas más usadas"
        descripcion="Principales etiquetas presentes en interacciones (actualizadas en vivo ante altas, cambios o bajas)."
        rutaApi="GET /api/metricas/etiquetas"
      >
        {consultaEtiquetas.datos &&
          !consultaEtiquetas.cargando &&
          !consultaEtiquetas.error && (
            <p className="nota-metrica">
              Top <strong>{consultaEtiquetas.datos.limite}</strong> etiquetas con
              mayor presencia en interacciones
            </p>
          )}
        <GraficaBarras
          categorias={configuracionEtiquetas.categorias}
          series={configuracionEtiquetas.series}
          horizontal
          tituloEjeValores="Interacciones"
          altura="320px"
          cargando={consultaEtiquetas.cargando}
          error={consultaEtiquetas.error}
          alReintentar={consultaEtiquetas.reintentar}
          etiquetaAria="Etiquetas más usadas en interacciones"
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

      <TarjetaSeccion
        id="seccion-demografia"
        titulo="Demografía del padrón"
        descripcion="Distribución de usuarios por rango de edad, interés principal y su cruce conjunto (sin datos de ubicación)."
        rutaApi="GET /api/metricas/demografia"
        anchoCompleto
      >
        {consultaDemografia.datos &&
          !consultaDemografia.cargando &&
          !consultaDemografia.error && (
            <p className="nota-metrica">
              Total analizado en padrón:{' '}
              <strong>
                {Number(consultaDemografia.datos.total).toLocaleString('es-MX')}
              </strong>{' '}
              usuarios
            </p>
          )}

        <div className="subrejilla-demografia">
          <div className="subbloque-demografia">
            <h3 className="subbloque-demografia__titulo">
              Usuarios por rango de edad
            </h3>
            <GraficaBarras
              categorias={configuracionDemografia.edadCategorias}
              series={configuracionDemografia.edadSeries}
              tituloEjeValores="Usuarios"
              altura="300px"
              cargando={consultaDemografia.cargando}
              error={consultaDemografia.error}
              alReintentar={consultaDemografia.reintentar}
              etiquetaAria="Usuarios por rango de edad"
            />
          </div>

          <div className="subbloque-demografia">
            <h3 className="subbloque-demografia__titulo">
              Usuarios por interés principal
            </h3>
            <GraficaBarras
              categorias={configuracionDemografia.interesCategorias}
              series={configuracionDemografia.interesSeries}
              horizontal
              tituloEjeValores="Usuarios"
              altura="300px"
              cargando={consultaDemografia.cargando}
              error={consultaDemografia.error}
              alReintentar={consultaDemografia.reintentar}
              etiquetaAria="Usuarios por interés principal"
            />
          </div>
        </div>

        <div className="subbloque-demografia subbloque-demografia--completo">
          <h3 className="subbloque-demografia__titulo">
            Cruce rango de edad × interés principal
          </h3>
          <div className="contenedor-mapa-calor">
            <div className="contenedor-mapa-calor__interno">
              <GraficaMapaCalor
                etiquetasHorizontal={configuracionDemografia.cruceHorizontal}
                etiquetasVertical={configuracionDemografia.cruceVertical}
                tituloHorizontal="Rango de edad"
                tituloVertical="Interés"
                nombreMetrica="Usuarios"
                celdas={configuracionDemografia.cruceCeldas}
                altura="360px"
                cargando={consultaDemografia.cargando}
                error={consultaDemografia.error}
                alReintentar={consultaDemografia.reintentar}
                etiquetaAria="Mapa de calor de rango de edad por interés principal"
              />
            </div>
          </div>
        </div>
      </TarjetaSeccion>
    </div>
  );
}
