import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import ControlSegmentado from '../componentes/ControlSegmentado';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
  MapaPuntosCalientes,
} from '../componentes/graficas';
import { useTemaGraficas } from '../componentes/graficas/temaGraficas';
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
import {
  formatearDecimal,
  formatearEntero,
  formatearFechaHoraUtc,
  formatearPorcentaje,
  formatearTiempoRelativo,
} from '../utilidades/formato';
import {
  resumenActividad,
  resumenCruce,
  resumenEdad,
  resumenEstatus,
  resumenEtiquetas,
  resumenGeografia,
  resumenInteres,
  resumenPlataformas,
  resumenPuntosCalientes,
  resumenTemas,
  resumenTipos,
} from '../utilidades/resumenes';

const NOMBRES_ESTATUS = {
  activo: 'Activo',
  en_riesgo: 'En riesgo',
  inactivo: 'Inactivo',
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

const SEGUNDOS_AVISO = 8;

// Reloj para los textos "hace X s"
function useAhora(cadaMs) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const temporizador = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(temporizador);
  }, [cadaMs]);
  return ahora;
}

// Aviso flotante de cambios (docs/DISENO.md §4.6): aparece abajo al centro y se desvanece
function AvisoFlotante({ cambio }) {
  const ahora = useAhora(1000);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!cambio) {
      return undefined;
    }
    setVisible(true);
    const temporizador = window.setTimeout(() => setVisible(false), SEGUNDOS_AVISO * 1000);
    return () => window.clearTimeout(temporizador);
  }, [cambio]);

  if (!cambio) {
    return null;
  }

  const accion = ETIQUETAS_CAMBIO[cambio.tipo] || `Interacción ${cambio.tipo}`;
  return (
    <div className={`aviso-flotante aviso-flotante--${cambio.tipo} ${visible ? 'aviso-flotante--visible' : ''}`} role="status" aria-live="polite">
      <span className="aviso-flotante__punto" aria-hidden="true" />
      <span>
        {accion} · <span className="aviso-flotante__id">{cambio.id_interaccion}</span> ·{' '}
        {formatearTiempoRelativo(cambio.recibidoEnMs, ahora)}
      </span>
    </div>
  );
}

// Controles del WebSocket en la barra superior: texto además del color
function ControlesEnVivo({ conexionWs, esperaReconexionSeg, solicitandoActualizacion, solicitarActualizacion, reconectarAhora }) {
  let indicador;
  if (conexionWs === 'conectado') {
    indicador = { clase: 'ok', texto: 'En vivo' };
  } else if (conexionWs === 'origen_rechazado') {
    indicador = { clase: 'error', texto: 'Conexión rechazada' };
  } else if (conexionWs === 'reconectando') {
    indicador = {
      clase: 'apagado',
      texto: esperaReconexionSeg > 0 ? `Sin conexión, reintento en ${esperaReconexionSeg} s` : 'Reconectando',
    };
  } else {
    indicador = { clase: 'apagado', texto: 'Conectando' };
  }

  return (
    <>
      <span className={`indicador indicador--${indicador.clase}`} role="status" aria-live="polite">
        <span className="indicador__punto" aria-hidden="true" />
        {indicador.texto}
      </span>
      {conexionWs === 'conectado' && (
        <button
          type="button"
          className="boton boton--primario boton--barra"
          onClick={solicitarActualizacion}
          disabled={solicitandoActualizacion}
        >
          {solicitandoActualizacion ? 'Actualizando…' : 'Actualizar en vivo'}
        </button>
      )}
      {(conexionWs === 'reconectando' || conexionWs === 'origen_rechazado') && (
        <button type="button" className="boton boton--secundario boton--barra" onClick={reconectarAhora}>
          Reconectar ahora
        </button>
      )}
    </>
  );
}

// Número grande con leyenda corta. La clave reinicia la animación breve cuando cambia el valor.
function Kpi({ valor, leyenda, enVivo = false }) {
  return (
    <div className="kpi">
      <p className="kpi__valor">
        <span key={valor} className="kpi__numero">
          {valor}
        </span>
      </p>
      <p className="kpi__leyenda">
        {leyenda}
        {enVivo && <span className="kpi__en-vivo">, en vivo</span>}
      </p>
    </div>
  );
}

function EncabezadoGrupo({ id, titulo, complemento }) {
  return (
    <h2 id={id} className="titulo-grupo">
      {titulo} <span className="titulo-grupo__complemento">{complemento}</span>
    </h2>
  );
}

export default function PaginaDashboard() {
  const contextoLayout = useOutletContext() || {};
  const tema = useTemaGraficas();
  const { cargandoCatalogos, errorCatalogos, obtenerNombreLegible } = useCatalogos();

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
  }, [consultaActividad, consultaEtiquetas, consultaPlataformas, consultaTemas, consultaTipos]);

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
  const ahora = useAhora(5000);

  const esperandoNombresCatalogo = cargandoCatalogos && !errorCatalogos;
  const nombrePlataforma = useCallback((codigo) => obtenerNombreLegible('plataforma', codigo), [obtenerNombreLegible]);
  const nombreTema = useCallback((codigo) => obtenerNombreLegible('tema', codigo), [obtenerNombreLegible]);

  // Colores fijos: interacciones en azul, usuarios en índigo, sentimiento en menta (continuidad entre gráficas)
  const colorInteracciones = tema.color('azul');
  const colorUsuarios = tema.color('indigo');
  const colorSentimiento = tema.color('menta');

  // --- Estatus ---------------------------------------------------------------------
  const estatus = useMemo(() => {
    const filas = consultaEstatus.datos?.datos;
    const total = Number(consultaEstatus.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return { dona: [], tabla: null };
    }
    return {
      dona: filas.map((fila) => ({
        nombre: NOMBRES_ESTATUS[fila.estatus] || fila.estatus,
        valor: fila.usuarios,
        porcentaje: fila.porcentaje,
        color: tema.estatus[fila.estatus],
      })),
      tabla: {
        titulo: 'Usuarios por estatus',
        columnas: ['Estatus', 'Usuarios', 'Porcentaje'],
        filas: filas.map((f) => [NOMBRES_ESTATUS[f.estatus] || f.estatus, formatearEntero(f.usuarios), formatearPorcentaje(f.porcentaje)]),
      },
    };
  }, [consultaEstatus.datos, tema]);

  // --- Geografía -------------------------------------------------------------------
  const geografia = useMemo(() => {
    const datosGeo = consultaGeografia.datos;
    const lista = datosGeo
      ? (nivelGeografia === 'ciudades' ? datosGeo.ciudades : datosGeo.estados) || []
      : [];
    if (lista.length === 0) {
      return { categorias: [], series: [], altura: '300px', tabla: null };
    }
    const nombre = (item) => (nivelGeografia === 'ciudades' ? `${item.ciudad}, ${item.estado}` : item.estado);
    const ordenadaVisual = [...lista].reverse();
    return {
      categorias: ordenadaVisual.map(nombre),
      series: [{ nombre: 'Usuarios con consentimiento', datos: ordenadaVisual.map((i) => i.usuarios), color: colorUsuarios }],
      altura: `${Math.max(280, ordenadaVisual.length * 34 + 24)}px`,
      tabla: {
        titulo: 'Usuarios con consentimiento por lugar',
        columnas: [nivelGeografia === 'ciudades' ? 'Ciudad' : 'Estado', 'País', 'Usuarios'],
        filas: lista.map((i) => [nombre(i), i.pais, formatearEntero(i.usuarios)]),
      },
    };
  }, [colorUsuarios, consultaGeografia.datos, nivelGeografia]);

  // --- Puntos calientes ------------------------------------------------------------
  const pc = consultaPuntosCalientes.datos;
  const tablaPuntos = useMemo(() => {
    if (!Array.isArray(pc?.datos) || pc.datos.length === 0) return null;
    return {
      titulo: 'Usuarios por cuadro del mapa',
      columnas: ['Centro del cuadro', 'Usuarios'],
      filas: pc.datos.map((c) => [
        `${formatearDecimal(c.latitud_centro, 1)}°, ${formatearDecimal(c.longitud_centro, 1)}°`,
        formatearEntero(c.usuarios),
      ]),
    };
  }, [pc]);

  // --- Plataformas -----------------------------------------------------------------
  const plataformas = useMemo(() => {
    const filas = consultaPlataformas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [], tabla: null };
    }
    return {
      categorias: filas.map((f) => nombrePlataforma(f.plataforma)),
      series: [
        { nombre: 'Usuarios', datos: filas.map((f) => f.usuarios), color: colorUsuarios },
        { nombre: 'Interacciones', datos: filas.map((f) => f.interacciones), color: colorInteracciones },
      ],
      tabla: {
        titulo: 'Usuarios e interacciones por plataforma',
        columnas: ['Plataforma', 'Usuarios', 'Interacciones'],
        filas: filas.map((f) => [nombrePlataforma(f.plataforma), formatearEntero(f.usuarios), formatearEntero(f.interacciones)]),
      },
    };
  }, [colorInteracciones, colorUsuarios, consultaPlataformas.datos, nombrePlataforma]);

  // --- Temas -----------------------------------------------------------------------
  const temas = useMemo(() => {
    const filas = consultaTemas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [], decimales: null, omitidos: 0, tabla: null };
    }
    const tabla = {
      titulo: 'Interacciones y sentimiento por tema',
      columnas: ['Tema', 'Interacciones', 'Sentimiento promedio'],
      filas: filas.map((f) => [
        nombreTema(f.tema),
        formatearEntero(f.interacciones),
        f.sentimiento_promedio === null || f.sentimiento_promedio === undefined ? 'Sin datos' : formatearDecimal(f.sentimiento_promedio, 3),
      ]),
    };
    if (vistaTemas === 'sentimiento') {
      const conDatos = filas.filter((f) => f.sentimiento_promedio !== null && f.sentimiento_promedio !== undefined);
      const ordenada = [...conDatos].reverse();
      return {
        categorias: ordenada.map((f) => nombreTema(f.tema)),
        series: [{ nombre: 'Sentimiento promedio', datos: ordenada.map((f) => f.sentimiento_promedio), color: colorSentimiento }],
        decimales: 3,
        omitidos: filas.length - conDatos.length,
        tabla,
      };
    }
    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((f) => nombreTema(f.tema)),
      series: [{ nombre: 'Interacciones', datos: ordenada.map((f) => f.interacciones), color: colorInteracciones }],
      decimales: null,
      omitidos: 0,
      tabla,
    };
  }, [colorInteracciones, colorSentimiento, consultaTemas.datos, nombreTema, vistaTemas]);

  // --- Tipos: un color por tipo según su lugar en el catálogo (la API los da en ese orden) ---
  const tipos = useMemo(() => {
    const filas = consultaTipos.datos?.datos;
    const total = Number(consultaTipos.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return { dona: [], tabla: null };
    }
    return {
      dona: filas.map((f, indice) => ({
        nombre: f.nombre || f.tipo,
        valor: f.interacciones,
        porcentaje: f.porcentaje,
        color: tema.categoria(indice),
      })),
      tabla: {
        titulo: 'Interacciones por tipo',
        columnas: ['Tipo', 'Interacciones', 'Porcentaje'],
        filas: filas.map((f) => [f.nombre || f.tipo, formatearEntero(f.interacciones), formatearPorcentaje(f.porcentaje)]),
      },
    };
  }, [consultaTipos.datos, tema]);

  // --- Etiquetas -------------------------------------------------------------------
  const etiquetas = useMemo(() => {
    const filas = consultaEtiquetas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [], tabla: null };
    }
    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((f) => f.nombre || f.etiqueta),
      series: [{ nombre: 'Interacciones con la etiqueta', datos: ordenada.map((f) => f.interacciones), color: colorInteracciones }],
      tabla: {
        titulo: 'Etiquetas más usadas',
        columnas: ['Etiqueta', 'Interacciones'],
        filas: filas.map((f) => [f.nombre || f.etiqueta, formatearEntero(f.interacciones)]),
      },
    };
  }, [colorInteracciones, consultaEtiquetas.datos]);

  // --- Actividad -------------------------------------------------------------------
  const actividad = useMemo(() => {
    const celdasApi = consultaActividad.datos?.datos;
    if (!Array.isArray(celdasApi) || celdasApi.length === 0) {
      return { horizontal: [], vertical: [], celdas: [], titulo: '', tabla: null };
    }
    const horas = Array.from(new Set(celdasApi.map((c) => c.hora))).sort((a, b) => a - b);
    const dias = Array.from(new Set(celdasApi.map((c) => c.dia_semana))).sort((a, b) => b - a);
    const indiceHora = new Map(horas.map((h, i) => [h, i]));
    const indiceDia = new Map(dias.map((d, i) => [d, i]));
    const zona = consultaActividad.datos?.zona_horaria || 'UTC';
    const conActividad = celdasApi
      .filter((c) => c.interacciones > 0)
      .sort((a, b) => b.interacciones - a.interacciones || a.dia_semana - b.dia_semana || a.hora - b.hora);

    return {
      horizontal: horas.map((h) => `${String(h).padStart(2, '0')}:00`),
      vertical: dias.map((d) => NOMBRES_DIA_SEMANA[d] || String(d)),
      celdas: celdasApi
        .filter((c) => indiceHora.has(c.hora) && indiceDia.has(c.dia_semana))
        .map((c) => [indiceHora.get(c.hora), indiceDia.get(c.dia_semana), c.interacciones]),
      titulo: `Hora del día (${zona})`,
      tabla:
        conActividad.length > 0
          ? {
              titulo: 'Horas con interacciones',
              columnas: ['Día y hora', 'Interacciones'],
              filas: conActividad.map((c) => [
                `${NOMBRES_DIA_SEMANA[c.dia_semana] || c.dia_semana}, ${String(c.hora).padStart(2, '0')}:00 ${zona}`,
                formatearEntero(c.interacciones),
              ]),
            }
          : null,
    };
  }, [consultaActividad.datos]);

  // --- Demografía ------------------------------------------------------------------
  const demografia = useMemo(() => {
    const demo = consultaDemografia.datos;
    const vacio = { edad: { categorias: [], series: [], tabla: null }, interes: { categorias: [], series: [], tabla: null }, cruce: { horizontal: [], vertical: [], celdas: [], tabla: null } };
    if (!demo) {
      return vacio;
    }
    const rangos = Array.isArray(demo.rangos_edad) ? demo.rangos_edad : [];
    const intereses = Array.isArray(demo.intereses) ? demo.intereses : [];
    const cruce = Array.isArray(demo.cruce) ? demo.cruce : [];
    const nombreRango = (r) => r.descripcion || r.rango_edad;
    const nombreInteres = (i) => i.nombre || i.interes;

    const interesesOrdenados = [...intereses].sort((a, b) => a.usuarios - b.usuarios);

    // Matriz completa rango_edad × interés (las combinaciones ausentes en cruce valen 0)
    const interesesVerticales = [...intereses].reverse();
    const mapaCruce = new Map(cruce.map((f) => [`${f.rango_edad}|${f.interes}`, f.usuarios]));
    const celdas = [];
    for (let x = 0; x < rangos.length; x += 1) {
      for (let y = 0; y < interesesVerticales.length; y += 1) {
        celdas.push([x, y, mapaCruce.get(`${rangos[x].rango_edad}|${interesesVerticales[y].interes}`) ?? 0]);
      }
    }
    const rangoPorCodigo = new Map(rangos.map((r) => [r.rango_edad, nombreRango(r)]));
    const interesPorCodigo = new Map(intereses.map((i) => [i.interes, nombreInteres(i)]));

    return {
      edad: {
        categorias: rangos.map(nombreRango),
        series: rangos.length ? [{ nombre: 'Usuarios', datos: rangos.map((r) => r.usuarios), color: colorUsuarios }] : [],
        tabla: {
          titulo: 'Usuarios por rango de edad',
          columnas: ['Rango de edad', 'Usuarios', 'Porcentaje'],
          filas: rangos.map((r) => [nombreRango(r), formatearEntero(r.usuarios), formatearPorcentaje(r.porcentaje)]),
        },
      },
      interes: {
        categorias: interesesOrdenados.map(nombreInteres),
        series: interesesOrdenados.length
          ? [{ nombre: 'Usuarios', datos: interesesOrdenados.map((i) => i.usuarios), color: colorUsuarios }]
          : [],
        tabla: {
          titulo: 'Usuarios por interés principal',
          columnas: ['Interés principal', 'Usuarios', 'Porcentaje'],
          filas: [...intereses]
            .sort((a, b) => b.usuarios - a.usuarios)
            .map((i) => [nombreInteres(i), formatearEntero(i.usuarios), formatearPorcentaje(i.porcentaje)]),
        },
      },
      cruce: {
        horizontal: rangos.map(nombreRango),
        vertical: interesesVerticales.map(nombreInteres),
        celdas,
        tabla: {
          titulo: 'Usuarios por rango de edad e interés principal',
          columnas: ['Rango de edad e interés', 'Usuarios'],
          filas: [...cruce]
            .sort((a, b) => b.usuarios - a.usuarios)
            .map((f) => [
              `${rangoPorCodigo.get(f.rango_edad) ?? f.rango_edad}, ${interesPorCodigo.get(f.interes) ?? f.interes}`,
              formatearEntero(f.usuarios),
            ]),
        },
      },
    };
  }, [colorUsuarios, consultaDemografia.datos]);

  // --- Frases-resumen (calculadas con los datos de la API) ----------------------------
  const frases = {
    estatus: resumenEstatus(consultaEstatus.datos, NOMBRES_ESTATUS),
    geografia: resumenGeografia(consultaGeografia.datos, nivelGeografia),
    puntos: resumenPuntosCalientes(pc),
    plataformas: esperandoNombresCatalogo ? '' : resumenPlataformas(consultaPlataformas.datos, nombrePlataforma),
    temas: esperandoNombresCatalogo ? '' : resumenTemas(consultaTemas.datos, nombreTema, vistaTemas),
    tipos: resumenTipos(consultaTipos.datos),
    etiquetas: resumenEtiquetas(consultaEtiquetas.datos),
    actividad: resumenActividad(consultaActividad.datos),
    edad: resumenEdad(consultaDemografia.datos),
    interes: resumenInteres(consultaDemografia.datos),
    cruce: resumenCruce(consultaDemografia.datos),
  };

  const generadoEn = r?.generado_en || ultimoEventoTs;
  const generadoMs = generadoEn ? Date.parse(generadoEn) : NaN;

  const controles = (
    <ControlesEnVivo
      conexionWs={conexionWs}
      esperaReconexionSeg={esperaReconexionSeg}
      solicitandoActualizacion={solicitandoActualizacion}
      solicitarActualizacion={solicitarActualizacion}
      reconectarAhora={reconectarAhora}
    />
  );

  return (
    <div className="pagina">
      {contextoLayout.ranuraEnVivo && createPortal(controles, contextoLayout.ranuraEnVivo)}

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">
          Comunidad en vivo. <span className="titulo-pagina__complemento">Así se mueve hoy.</span>
        </h1>
        <p className="nota">
          {Number.isFinite(generadoMs)
            ? `Actualizado ${formatearTiempoRelativo(generadoMs, ahora)} · ${formatearFechaHoraUtc(generadoEn)}`
            : 'Esperando el primer resumen en vivo…'}
        </p>
      </header>

      {avisoServicioResumen && r && (
        <p className="aviso-en-linea" role="alert">
          No se pudo calcular el resumen nuevo ({avisoServicioResumen.replace(/\.$/, '')}). Se muestran los últimos datos recibidos; la página se actualizará sola cuando vuelva la conexión.
        </p>
      )}

      <section className="kpis" aria-label="Indicadores en vivo">
        {r ? (
          <>
            <Kpi valor={formatearEntero(r.interacciones)} leyenda="interacciones" enVivo />
            <Kpi valor={formatearEntero(r.usuarios_que_interactuan)} leyenda="usuarios que interactúan" enVivo />
            <Kpi
              valor={r.sentimiento_promedio === null || r.sentimiento_promedio === undefined ? 'Sin datos' : formatearDecimal(r.sentimiento_promedio, 3)}
              leyenda="sentimiento promedio, de -1 a 1"
              enVivo
            />
            <Kpi valor={formatearEntero(r.usuarios)} leyenda="usuarios en el padrón" />
            <Kpi valor={formatearEntero(r.usuarios_activos)} leyenda={`activos, ${formatearPorcentaje(r.porcentaje_activos)} del padrón`} />
            <Kpi valor={formatearEntero(r.usuarios_con_consentimiento)} leyenda="con consentimiento de datos" />
            <Kpi valor={formatearEntero(r.en_cuarentena)} leyenda="registros en cuarentena" />
          </>
        ) : avisoServicioResumen || conexionWs === 'origen_rechazado' ? (
          <div className="estado-grafica estado-grafica--error kpis__estado" role="alert">
            <p className="estado-grafica__titulo">No se pudo recibir el resumen en vivo.</p>
            <p className="estado-grafica__texto">
              {avisoServicioResumen
                ? `${avisoServicioResumen.replace(/\.$/, '')}. Revisa la conexión y elige Reintentar.`
                : 'El servidor rechazó la conexión en vivo. Abre el dashboard desde http://localhost:5173 y elige Reintentar.'}
            </p>
            <button type="button" className="boton boton--secundario" onClick={reconectarAhora}>
              Reintentar
            </button>
          </div>
        ) : (
          [1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} className="kpi kpi--esqueleto" aria-hidden="true">
              <span className="esqueleto-linea esqueleto-linea--grande" />
              <span className="esqueleto-linea" />
            </div>
          ))
        )}
        {!r && !avisoServicioResumen && conexionWs !== 'origen_rechazado' && (
          <span className="sr-only" role="status">Cargando indicadores</span>
        )}
      </section>

      {/* Interacciones: cambian con cada alta, cambio o baja ------------------------- */}
      <section className="grupo" aria-labelledby="grupo-interacciones">
        <EncabezadoGrupo id="grupo-interacciones" titulo="Interacciones." complemento="Cambian con cada alta, cambio o baja." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-plataformas"
            titulo="Plataformas"
            subtitulo="Usuarios del padrón e interacciones por plataforma, en número de registros."
            resumen={frases.plataformas}
            esperandoResumen={consultaPlataformas.cargando || esperandoNombresCatalogo}
            fuente="GET /api/metricas/plataformas"
            ancho="ancho"
          >
            <GraficaBarras
              categorias={plataformas.categorias}
              series={plataformas.series}
              altura="320px"
              cargando={consultaPlataformas.cargando || esperandoNombresCatalogo}
              error={consultaPlataformas.error}
              alReintentar={consultaPlataformas.reintentar}
              etiquetaAria={`Gráfica de barras agrupadas. Eje horizontal: plataformas; eje vertical: número de usuarios e interacciones. ${frases.plataformas}`}
              tabla={plataformas.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-tipos"
            titulo="Tipos de interacción"
            subtitulo={
              consultaTipos.datos
                ? `Porcentaje de ${formatearEntero(consultaTipos.datos.total)} interacciones.`
                : 'Porcentaje del total de interacciones.'
            }
            resumen={frases.tipos}
            esperandoResumen={consultaTipos.cargando}
            fuente="GET /api/metricas/tipos"
            ancho="angosto"
          >
            <GraficaDona
              datos={tipos.dona}
              nombreSerie="Interacciones"
              total={consultaTipos.datos?.total ?? null}
              leyendaTotal="interacciones"
              altura="320px"
              cargando={consultaTipos.cargando}
              error={consultaTipos.error}
              alReintentar={consultaTipos.reintentar}
              etiquetaAria={`Gráfica de dona con el porcentaje de interacciones de cada tipo. ${frases.tipos}`}
              tabla={tipos.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-temas"
            titulo="Temas"
            subtitulo={
              vistaTemas === 'sentimiento'
                ? 'Sentimiento promedio por tema, de -1 (negativo) a 1 (positivo).'
                : 'Interacciones por tema, en número de registros.'
            }
            resumen={frases.temas}
            esperandoResumen={consultaTemas.cargando || esperandoNombresCatalogo}
            fuente="GET /api/metricas/temas"
          >
            <div className="controles-tarjeta">
              <ControlSegmentado
                etiqueta="Dato de temas"
                valor={vistaTemas}
                alCambiar={setVistaTemas}
                opciones={[
                  { valor: 'interacciones', texto: 'Interacciones' },
                  { valor: 'sentimiento', texto: 'Sentimiento' },
                ]}
              />
              {vistaTemas === 'sentimiento' && temas.omitidos > 0 && (
                <p className="nota">
                  {temas.omitidos === 1 ? '1 tema sin interacciones no tiene promedio.' : `${temas.omitidos} temas sin interacciones no tienen promedio.`}
                </p>
              )}
            </div>
            <GraficaBarras
              categorias={temas.categorias}
              series={temas.series}
              horizontal
              decimales={temas.decimales}
              altura="330px"
              cargando={consultaTemas.cargando || esperandoNombresCatalogo}
              error={consultaTemas.error}
              alReintentar={consultaTemas.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: temas; eje horizontal: ${
                vistaTemas === 'sentimiento' ? 'sentimiento promedio' : 'número de interacciones'
              }. ${frases.temas}`}
              tabla={temas.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-etiquetas"
            titulo="Etiquetas más usadas"
            subtitulo={
              consultaEtiquetas.datos
                ? `Las ${formatearEntero(consultaEtiquetas.datos.limite)} con más uso, en número de interacciones que las llevan.`
                : 'En número de interacciones que las llevan.'
            }
            resumen={frases.etiquetas}
            esperandoResumen={consultaEtiquetas.cargando}
            fuente="GET /api/metricas/etiquetas"
          >
            <GraficaBarras
              categorias={etiquetas.categorias}
              series={etiquetas.series}
              horizontal
              altura="330px"
              cargando={consultaEtiquetas.cargando}
              error={consultaEtiquetas.error}
              alReintentar={consultaEtiquetas.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: etiquetas; eje horizontal: número de interacciones. ${frases.etiquetas}`}
              tabla={etiquetas.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-actividad"
            titulo="Actividad por día y hora"
            subtitulo={`Interacciones por hora de cada día de la semana, en hora ${consultaActividad.datos?.zona_horaria || 'UTC'}.`}
            resumen={frases.actividad}
            esperandoResumen={consultaActividad.cargando}
            fuente="GET /api/metricas/actividad"
            ancho="completo"
          >
            <div className="desplazable">
              <div className="desplazable__interno">
                <GraficaMapaCalor
                  etiquetasHorizontal={actividad.horizontal}
                  etiquetasVertical={actividad.vertical}
                  tituloHorizontal={actividad.titulo}
                  nombreMetrica="Interacciones"
                  celdas={actividad.celdas}
                  altura="340px"
                  cargando={consultaActividad.cargando}
                  error={consultaActividad.error}
                  alReintentar={consultaActividad.reintentar}
                  etiquetaAria={`Mapa de calor. Eje horizontal: hora del día; eje vertical: día de la semana; color: número de interacciones. ${frases.actividad}`}
                  tabla={actividad.tabla}
                />
              </div>
            </div>
          </TarjetaSeccion>
        </div>
      </section>

      {/* Geografía: solo usuarios con consentimiento ---------------------------------- */}
      <section className="grupo" aria-labelledby="grupo-geografia">
        <EncabezadoGrupo id="grupo-geografia" titulo="Geografía." complemento="Solo usuarios con consentimiento." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-puntos-calientes"
            titulo="Puntos calientes"
            subtitulo={`Usuarios por cuadro de ${pc?.tamano_cuadro ?? 0.2}° (unos 22 km por lado). Selecciona un cuadro para ver cuántos usuarios tiene.`}
            resumen={frases.puntos}
            esperandoResumen={consultaPuntosCalientes.cargando}
            insignias={['Solo con consentimiento', `Cuadros con ${pc?.minimo_por_cuadro ?? 3} usuarios o más`]}
            fuente="GET /api/metricas/puntos-calientes"
            ancho="completo"
          >
            <MapaPuntosCalientes
              datos={pc?.datos ?? null}
              tamanoCuadro={pc?.tamano_cuadro ?? 0.2}
              altura="440px"
              cargando={consultaPuntosCalientes.cargando}
              error={consultaPuntosCalientes.error}
              alReintentar={consultaPuntosCalientes.reintentar}
              etiquetaAria={`Mapa interactivo con cuadros de ${pc?.tamano_cuadro ?? 0.2} grados; el color indica cuántos usuarios hay en cada cuadro. ${frases.puntos}`}
              tabla={tablaPuntos}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-geografia"
            titulo="Estados y ciudades"
            subtitulo={
              consultaGeografia.datos
                ? `Usuarios con consentimiento por lugar. Se ocultan los grupos de menos de ${consultaGeografia.datos.minimo_por_grupo}.`
                : 'Usuarios con consentimiento por lugar.'
            }
            resumen={frases.geografia}
            esperandoResumen={consultaGeografia.cargando}
            insignias={consultaGeografia.datos ? ['Solo con consentimiento', `Grupos con ${consultaGeografia.datos.minimo_por_grupo} usuarios o más`] : ['Solo con consentimiento']}
            fuente="GET /api/metricas/geografia"
            ancho="completo"
          >
            <div className="controles-tarjeta">
              <ControlSegmentado
                etiqueta="Agrupar por"
                valor={nivelGeografia}
                alCambiar={setNivelGeografia}
                opciones={[
                  { valor: 'estados', texto: 'Estados' },
                  { valor: 'ciudades', texto: 'Ciudades' },
                ]}
              />
            </div>
            <GraficaBarras
              categorias={geografia.categorias}
              series={geografia.series}
              horizontal
              altura={geografia.altura}
              cargando={consultaGeografia.cargando}
              error={consultaGeografia.error}
              alReintentar={consultaGeografia.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: ${
                nivelGeografia === 'ciudades' ? 'ciudades' : 'estados'
              }; eje horizontal: usuarios con consentimiento. ${frases.geografia}`}
              tabla={geografia.tabla}
            />
          </TarjetaSeccion>
        </div>
      </section>

      {/* Usuarios: el padrón de TiDB -------------------------------------------------- */}
      <section className="grupo" aria-labelledby="grupo-usuarios">
        <EncabezadoGrupo id="grupo-usuarios" titulo="Usuarios." complemento="Cómo es el padrón." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-estatus"
            titulo="Estatus"
            subtitulo="Porcentaje del padrón según los días desde su última actividad."
            resumen={frases.estatus}
            esperandoResumen={consultaEstatus.cargando}
            fuente="GET /api/metricas/estatus"
            ancho="tercio"
          >
            <GraficaDona
              datos={estatus.dona}
              nombreSerie="Usuarios"
              total={consultaEstatus.datos?.total ?? null}
              leyendaTotal="usuarios"
              altura="300px"
              cargando={consultaEstatus.cargando}
              error={consultaEstatus.error}
              alReintentar={consultaEstatus.reintentar}
              etiquetaAria={`Gráfica de dona con el porcentaje de usuarios por estatus. ${frases.estatus}`}
              tabla={estatus.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-edad"
            titulo="Rango de edad"
            subtitulo="Usuarios por rango de edad, en años."
            resumen={frases.edad}
            esperandoResumen={consultaDemografia.cargando}
            fuente="GET /api/metricas/demografia"
            ancho="tercio"
          >
            <GraficaBarras
              categorias={demografia.edad.categorias}
              series={demografia.edad.series}
              altura="300px"
              cargando={consultaDemografia.cargando}
              error={consultaDemografia.error}
              alReintentar={consultaDemografia.reintentar}
              etiquetaAria={`Gráfica de barras. Eje horizontal: rango de edad; eje vertical: número de usuarios. ${frases.edad}`}
              tabla={demografia.edad.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-interes"
            titulo="Interés principal"
            subtitulo="Usuarios por interés principal."
            resumen={frases.interes}
            esperandoResumen={consultaDemografia.cargando}
            fuente="GET /api/metricas/demografia"
            ancho="tercio"
          >
            <GraficaBarras
              categorias={demografia.interes.categorias}
              series={demografia.interes.series}
              horizontal
              altura="300px"
              cargando={consultaDemografia.cargando}
              error={consultaDemografia.error}
              alReintentar={consultaDemografia.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: interés principal; eje horizontal: número de usuarios. ${frases.interes}`}
              tabla={demografia.interes.tabla}
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-demografia"
            titulo="Edad e interés"
            subtitulo="Usuarios por rango de edad e interés principal. Sin datos de ubicación."
            resumen={frases.cruce}
            esperandoResumen={consultaDemografia.cargando}
            fuente="GET /api/metricas/demografia"
            ancho="completo"
          >
            <div className="desplazable">
              <div className="desplazable__interno desplazable__interno--angosto">
                <GraficaMapaCalor
                  etiquetasHorizontal={demografia.cruce.horizontal}
                  etiquetasVertical={demografia.cruce.vertical}
                  tituloHorizontal="Rango de edad"
                  nombreMetrica="Usuarios"
                  celdas={demografia.cruce.celdas}
                  altura="380px"
                  cargando={consultaDemografia.cargando}
                  error={consultaDemografia.error}
                  alReintentar={consultaDemografia.reintentar}
                  etiquetaAria={`Mapa de calor. Eje horizontal: rango de edad; eje vertical: interés principal; color: número de usuarios. ${frases.cruce}`}
                  tabla={demografia.cruce.tabla}
                />
              </div>
            </div>
          </TarjetaSeccion>
        </div>
      </section>

      <AvisoFlotante cambio={ultimoCambio} />
    </div>
  );
}
