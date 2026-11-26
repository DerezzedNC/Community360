import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Aurora from '../componentes/Aurora';
import ControlSegmentado from '../componentes/ControlSegmentado';
import { IconoCambio } from '../componentes/Iconos';
import TarjetaSeccion, { useRevelar } from '../componentes/TarjetaSeccion';
import {
  GraficaBarras,
  GraficaDona,
  GraficaMapaCalor,
  MapaPuntosCalientes,
} from '../componentes/graficas';
import { useTemaGraficas } from '../componentes/graficas/temaGraficas';
import { useCatalogos } from '../contextos/ContextoCatalogos';
import { useAlCambiarEnVivo, useEnVivo } from '../contextos/ContextoEnVivo';
import useConsultaApi from '../hooks/useConsultaApi';
import usePreferenciasSistema from '../hooks/usePreferenciasSistema';
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

const SECCIONES = [
  { id: 'grupo-resumen', texto: 'Resumen' },
  { id: 'grupo-interacciones', texto: 'Interacciones' },
  { id: 'grupo-geografia', texto: 'Geografía' },
  { id: 'grupo-usuarios', texto: 'Usuarios' },
];

const SEGUNDOS_CHIP = 4;
const ALTO_FILA_CALOR = 34;

function useAhora(cadaMs) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(t);
  }, [cadaMs]);
  return ahora;
}

// Números que cuentan (§8.2): del valor anterior al nuevo en 0.6 s. Sin animación si se pide.
function useNumeroAnimado(valor, reducirMovimiento) {
  const objetivo = Number(valor);
  const [mostrado, setMostrado] = useState(reducirMovimiento ? objetivo : 0);
  const anteriorRef = useRef(reducirMovimiento ? objetivo : 0);

  useEffect(() => {
    if (!Number.isFinite(objetivo)) return undefined;
    const desde = anteriorRef.current;
    anteriorRef.current = objetivo;
    if (reducirMovimiento || desde === objetivo) {
      setMostrado(objetivo);
      return undefined;
    }
    const inicio = performance.now();
    let cuadro;
    const paso = (momento) => {
      const t = Math.min(1, (momento - inicio) / 600);
      const suave = 1 - (1 - t) ** 3;
      setMostrado(desde + (objetivo - desde) * suave);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(cuadro);
      setMostrado(objetivo);
    };
  }, [objetivo, reducirMovimiento]);

  return mostrado;
}

// Chip "+1" o "−1" durante 4 s cuando el evento cambió este indicador
function ChipCambio({ cambio, recibidoEnMs }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!cambio) return undefined;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), SEGUNDOS_CHIP * 1000);
    return () => window.clearTimeout(t);
  }, [cambio, recibidoEnMs]);
  if (!cambio || !visible) return null;
  const sube = cambio > 0;
  return (
    <span className={`chip-cambio ${sube ? 'chip-cambio--sube' : 'chip-cambio--baja'}`}>
      {sube ? `+${formatearEntero(cambio)}` : `−${formatearEntero(Math.abs(cambio))}`}
      <span className="sr-only">{sube ? ' más que antes' : ' menos que antes'}</span>
    </span>
  );
}

function Kpi({ valor, decimales = 0, leyenda, cambio = 0, recibidoEnMs = 0, textoSinDatos = 'Sin datos', grande = false }) {
  const { reducirMovimiento } = usePreferenciasSistema();
  const mostrado = useNumeroAnimado(valor, reducirMovimiento);
  const sinDato = valor === null || valor === undefined || !Number.isFinite(Number(valor));
  return (
    <div className={`kpi ${grande ? 'kpi--grande' : ''}`}>
      <p className="kpi__valor">
        {sinDato ? textoSinDatos : decimales > 0 ? formatearDecimal(mostrado, decimales) : formatearEntero(Math.round(mostrado))}
        <ChipCambio cambio={cambio} recibidoEnMs={recibidoEnMs} />
      </p>
      <p className="kpi__leyenda">{leyenda}</p>
    </div>
  );
}

// Mini gráfica de la sesión: el total de interacciones en cada resumen recibido (datos reales)
function MiniGrafica({ serie }) {
  if (serie.length < 2) {
    return (
      <p className="mini-grafica__leyenda">
        La línea de esta sesión aparece desde el segundo resumen recibido (con un cambio o con Actualizar en vivo).
      </p>
    );
  }
  const valores = serie.map((p) => p.interacciones);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const ancho = 240;
  const alto = 56;
  const puntos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * ancho;
    const y = max === min ? alto / 2 : alto - 6 - ((v - min) / (max - min)) * (alto - 12);
    return [x, y];
  });
  const linea = puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <figure className="mini-grafica">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Total de interacciones en ${valores.length} resúmenes de esta sesión: de ${formatearEntero(valores[0])} a ${formatearEntero(valores[valores.length - 1])}.`}
      >
        <polyline points={`0,${alto} ${linea} ${ancho},${alto}`} className="mini-grafica__area" />
        <polyline points={linea} className="mini-grafica__linea" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mini-grafica__leyenda">
        En esta sesión: de {formatearEntero(min)} a {formatearEntero(max)}, en {valores.length} resúmenes recibidos.
      </figcaption>
    </figure>
  );
}

// Panel "Actividad reciente": eventos metricas.actualizadas con cambio, en memoria (máximo 10)
function ActividadReciente({ eventos }) {
  const ahora = useAhora(1000);
  if (eventos.length === 0) {
    return (
      <div className="actividad-vacia">
        <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" className="dibujo-vacio">
          <path d="M2 30h12l6-16 8 24 6-12h28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p>Sin cambios desde que abriste el panel. Envía una petición desde Postman para verla aquí.</p>
      </div>
    );
  }
  return (
    <ol className="actividad-lista">
      {eventos.map((evento) => (
        <li key={evento.recibidoEnMs} className={`actividad-lista__item actividad-lista__item--${evento.tipo}`}>
          <IconoCambio tipo={evento.tipo} />
          <span>
            {ETIQUETAS_CAMBIO[evento.tipo] || `Interacción ${evento.tipo}`} ·{' '}
            <span className="actividad-lista__id">{evento.id_interaccion}</span> ·{' '}
            <span className="actividad-lista__tiempo">{formatearTiempoRelativo(evento.recibidoEnMs, ahora)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// Índice fijo de secciones: marca la visible y lleva a ella (§8.3)
function IndiceSecciones() {
  const [activa, setActiva] = useState(SECCIONES[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const visibles = new Map();
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => visibles.set(e.target.id, e.isIntersecting));
        const primera = SECCIONES.find((s) => visibles.get(s.id));
        if (primera) setActiva(primera.id);
      },
      { rootMargin: '-150px 0px -55% 0px' }
    );
    SECCIONES.forEach((s) => {
      const nodo = document.getElementById(s.id);
      if (nodo) observador.observe(nodo);
    });
    return () => observador.disconnect();
  }, []);

  return (
    <nav className="indice" aria-label="Secciones del panel">
      <div className="indice__pildora">
        {SECCIONES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`indice__enlace ${activa === s.id ? 'indice__enlace--activo' : ''}`}
            aria-current={activa === s.id ? 'true' : undefined}
            onClick={() => setActiva(s.id)}
          >
            {s.texto}
          </a>
        ))}
      </div>
    </nav>
  );
}

function EncabezadoGrupo({ id, titulo, complemento }) {
  return (
    <h2 id={`${id}-titulo`} className="titulo-grupo">
      {titulo} <span className="titulo-grupo__complemento">{complemento}</span>
    </h2>
  );
}

function BloqueRevelado({ className = '', orden = 0, etiqueta, children }) {
  const [ref, visible] = useRevelar();
  return (
    <section
      ref={ref}
      className={`${className} revelar ${visible ? 'revelar--visible' : ''}`}
      style={{ '--retraso': `${(orden % 4) * 60}ms` }}
      aria-label={etiqueta}
    >
      {children}
    </section>
  );
}

export default function PaginaDashboard() {
  const tema = useTemaGraficas();
  const { cargandoCatalogos, errorCatalogos, obtenerNombreLegible, obtenerIndiceCodigo } = useCatalogos();

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

  // El WebSocket vive en el layout (mismo hook); esta vista solo registra qué refrescar
  useAlCambiarEnVivo(manejarCambioTiempoReal);
  const { conexionWs, resumen: r, ultimoEventoTs, avisoServicioResumen, reconectarAhora, eventos, serie, delta } =
    useEnVivo();

  const [nivelGeografia, setNivelGeografia] = useState('estados');
  const [vistaTemas, setVistaTemas] = useState('interacciones');
  const ahora = useAhora(5000);

  const esperandoNombresCatalogo = cargandoCatalogos && !errorCatalogos;
  const nombrePlataforma = useCallback((codigo) => obtenerNombreLegible('plataforma', codigo), [obtenerNombreLegible]);
  const nombreTema = useCallback((codigo) => obtenerNombreLegible('tema', codigo), [obtenerNombreLegible]);
  // §8.4: un color fijo por código del catálogo, el mismo en todas las gráficas
  const colorDe = useCallback(
    (catalogo, codigo) => tema.categoria(obtenerIndiceCodigo(catalogo, codigo)),
    [obtenerIndiceCodigo, tema]
  );

  const colorUsuarios = tema.color('indigo');

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
    const lista = datosGeo ? (nivelGeografia === 'ciudades' ? datosGeo.ciudades : datosGeo.estados) || [] : [];
    if (lista.length === 0) {
      return { categorias: [], series: [], altura: '300px', tabla: null };
    }
    const nombre = (item) => (nivelGeografia === 'ciudades' ? `${item.ciudad}, ${item.estado}` : item.estado);
    const ordenadaVisual = [...lista].reverse();
    return {
      categorias: ordenadaVisual.map(nombre),
      series: [{ nombre: 'Usuarios con consentimiento', datos: ordenadaVisual.map((i) => i.usuarios), color: colorUsuarios }],
      altura: `${Math.max(280, ordenadaVisual.length * 30 + 24)}px`,
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

  // --- Plataformas: color de cada plataforma; interacciones en tono pleno y usuarios en tono claro
  const plataformas = useMemo(() => {
    const filas = consultaPlataformas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [], tabla: null };
    }
    const colores = filas.map((f) => colorDe('plataforma', f.plataforma));
    return {
      categorias: filas.map((f) => nombrePlataforma(f.plataforma)),
      series: [
        { nombre: 'Interacciones (tono pleno)', datos: filas.map((f) => f.interacciones), colores, color: tema.texto },
        { nombre: 'Usuarios (tono claro)', datos: filas.map((f) => f.usuarios), colores, opacidad: 0.38, color: tema.texto2 },
      ],
      tabla: {
        titulo: 'Usuarios e interacciones por plataforma',
        columnas: ['Plataforma', 'Interacciones', 'Usuarios'],
        filas: filas.map((f) => [nombrePlataforma(f.plataforma), formatearEntero(f.interacciones), formatearEntero(f.usuarios)]),
      },
    };
  }, [colorDe, consultaPlataformas.datos, nombrePlataforma, tema]);

  // --- Temas: color por tema; en la vista de sentimiento, escala divergente ----------
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
        series: [
          {
            nombre: 'Sentimiento promedio',
            datos: ordenada.map((f) => f.sentimiento_promedio),
            colores: ordenada.map((f) => tema.colorSentimiento(f.sentimiento_promedio)),
          },
        ],
        decimales: 3,
        omitidos: filas.length - conDatos.length,
        tabla,
      };
    }
    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((f) => nombreTema(f.tema)),
      series: [
        {
          nombre: 'Interacciones',
          datos: ordenada.map((f) => f.interacciones),
          colores: ordenada.map((f) => colorDe('tema', f.tema)),
        },
      ],
      decimales: null,
      omitidos: 0,
      tabla,
    };
  }, [colorDe, consultaTemas.datos, nombreTema, tema, vistaTemas]);

  // --- Tipos ------------------------------------------------------------------------
  const tipos = useMemo(() => {
    const filas = consultaTipos.datos?.datos;
    const total = Number(consultaTipos.datos?.total ?? 0);
    if (!Array.isArray(filas) || filas.length === 0 || total === 0) {
      return { dona: [], tabla: null };
    }
    return {
      dona: filas.map((f) => ({
        nombre: f.nombre || f.tipo,
        valor: f.interacciones,
        porcentaje: f.porcentaje,
        color: colorDe('tipo_interaccion', f.tipo),
      })),
      tabla: {
        titulo: 'Interacciones por tipo',
        columnas: ['Tipo', 'Interacciones', 'Porcentaje'],
        filas: filas.map((f) => [f.nombre || f.tipo, formatearEntero(f.interacciones), formatearPorcentaje(f.porcentaje)]),
      },
    };
  }, [colorDe, consultaTipos.datos]);

  // --- Etiquetas ---------------------------------------------------------------------
  const etiquetas = useMemo(() => {
    const filas = consultaEtiquetas.datos?.datos;
    if (!Array.isArray(filas) || filas.length === 0) {
      return { categorias: [], series: [], tabla: null };
    }
    const ordenada = [...filas].reverse();
    return {
      categorias: ordenada.map((f) => f.nombre || f.etiqueta),
      series: [
        {
          nombre: 'Interacciones con la etiqueta',
          datos: ordenada.map((f) => f.interacciones),
          colores: ordenada.map((f) => colorDe('etiqueta', f.etiqueta)),
        },
      ],
      tabla: {
        titulo: 'Etiquetas más usadas',
        columnas: ['Etiqueta', 'Interacciones'],
        filas: filas.map((f) => [f.nombre || f.etiqueta, formatearEntero(f.interacciones)]),
      },
    };
  }, [colorDe, consultaEtiquetas.datos]);

  // --- Actividad ---------------------------------------------------------------------
  const actividad = useMemo(() => {
    const celdasApi = consultaActividad.datos?.datos;
    if (!Array.isArray(celdasApi) || celdasApi.length === 0) {
      return { horizontal: [], vertical: [], celdas: [], titulo: '', tabla: null, filas: 7 };
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
      filas: dias.length,
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

  // --- Demografía ----------------------------------------------------------------------
  const demografia = useMemo(() => {
    const demo = consultaDemografia.datos;
    const vacio = {
      edad: { categorias: [], series: [], tabla: null },
      interes: { categorias: [], series: [], tabla: null },
      cruce: { horizontal: [], vertical: [], celdas: [], tabla: null },
    };
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
  const cambioDe = (campo) => (delta && delta[campo] ? delta[campo] : 0);
  const filasCruce = demografia.cruce.vertical.length || 10;

  return (
    <div className="pagina">
      <header className="encabezado-pagina encabezado-pagina--aurora">
        <Aurora tenue />
        <h1 className="titulo-pagina">
          Comunidad en vivo. <span className="titulo-pagina__complemento">Así se mueve hoy.</span>
        </h1>
        <p className="nota">
          {Number.isFinite(generadoMs)
            ? `Actualizado ${formatearTiempoRelativo(generadoMs, ahora)} · ${formatearFechaHoraUtc(generadoEn)}`
            : 'Esperando el primer resumen en vivo…'}
        </p>
      </header>

      <IndiceSecciones />

      {avisoServicioResumen && r && (
        <p className="aviso-en-linea" role="alert">
          No se pudo calcular el resumen nuevo ({avisoServicioResumen.replace(/\.$/, '')}). Se muestran los últimos datos recibidos; la página se actualizará sola cuando vuelva la conexión.
        </p>
      )}

      {/* Resumen ----------------------------------------------------------------- */}
      <section id="grupo-resumen" className="grupo grupo--primero" aria-labelledby="grupo-resumen-titulo">
        <h2 id="grupo-resumen-titulo" className="sr-only">
          Resumen
        </h2>
        {r ? (
          <div className="bento">
            <BloqueRevelado className="tarjeta tarjeta--ancho kpi-principal" orden={0} etiqueta="Interacciones">
              <p className="grupo-kpi__titulo">
                <span className="punto-vivo" aria-hidden="true" />
                Interacciones
              </p>
              <Kpi
                grande
                valor={r.interacciones}
                leyenda="interacciones registradas en Capella"
                cambio={cambioDe('interacciones')}
                recibidoEnMs={delta?.recibidoEnMs}
              />
              <MiniGrafica serie={serie} />
            </BloqueRevelado>

            <BloqueRevelado className="tarjeta tarjeta--angosto actividad-reciente" orden={1} etiqueta="Actividad reciente">
              <h3 className="tarjeta__titulo">Actividad reciente</h3>
              <p className="tarjeta__subtitulo">Cambios recibidos en esta sesión, del más nuevo al más antiguo.</p>
              <ActividadReciente eventos={eventos} />
            </BloqueRevelado>

            <BloqueRevelado className="tarjeta tarjeta--angosto grupo-kpi" orden={0} etiqueta="Indicadores en vivo">
              <p className="grupo-kpi__titulo">
                <span className="punto-vivo" aria-hidden="true" />
                En vivo
              </p>
              <div className="grupo-kpi__lista">
                <Kpi
                  valor={r.usuarios_que_interactuan}
                  leyenda="usuarios que interactúan"
                  cambio={cambioDe('usuarios_que_interactuan')}
                  recibidoEnMs={delta?.recibidoEnMs}
                />
                <Kpi valor={r.sentimiento_promedio} decimales={3} leyenda="sentimiento promedio, de -1 a 1" />
              </div>
            </BloqueRevelado>

            <BloqueRevelado className="tarjeta tarjeta--ancho grupo-kpi" orden={1} etiqueta="Indicadores del padrón">
              <p className="grupo-kpi__titulo">Padrón</p>
              <div className="grupo-kpi__lista">
                <Kpi valor={r.usuarios} leyenda="usuarios" cambio={cambioDe('usuarios')} recibidoEnMs={delta?.recibidoEnMs} />
                <Kpi valor={r.usuarios_activos} leyenda={`activos, ${formatearPorcentaje(r.porcentaje_activos)}`} />
                <Kpi valor={r.usuarios_con_consentimiento} leyenda="con consentimiento" />
                <Kpi
                  valor={r.en_cuarentena}
                  leyenda="en cuarentena"
                  cambio={cambioDe('en_cuarentena')}
                  recibidoEnMs={delta?.recibidoEnMs}
                />
              </div>
            </BloqueRevelado>
          </div>
        ) : avisoServicioResumen || conexionWs === 'origen_rechazado' ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
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
          <div className="bento" role="status" aria-live="polite">
            <span className="sr-only">Cargando indicadores</span>
            {['ancho', 'angosto', 'angosto', 'ancho'].map((ancho, n) => (
              <div key={n} className={`tarjeta tarjeta--${ancho} kpi--esqueleto`} aria-hidden="true">
                <span className="esqueleto-linea esqueleto-linea--grande" />
                <span className="esqueleto-linea" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interacciones: cambian con cada alta, cambio o baja ------------------------- */}
      <section id="grupo-interacciones" className="grupo" aria-labelledby="grupo-interacciones-titulo">
        <EncabezadoGrupo id="grupo-interacciones" titulo="Interacciones." complemento="Cambian con cada alta, cambio o baja." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-plataformas"
            titulo="Plataformas"
            subtitulo="Interacciones (tono pleno) y usuarios del padrón (tono claro) por plataforma, en número de registros."
            resumen={frases.plataformas}
            esperandoResumen={consultaPlataformas.cargando || esperandoNombresCatalogo}
            ancho="ancho"
            orden={0}
          >
            <GraficaBarras
              categorias={plataformas.categorias}
              series={plataformas.series}
              altura="320px"
              cargando={consultaPlataformas.cargando || esperandoNombresCatalogo}
              error={consultaPlataformas.error}
              alReintentar={consultaPlataformas.reintentar}
              etiquetaAria={`Gráfica de barras agrupadas. Eje horizontal: plataformas; eje vertical: número de interacciones y de usuarios. ${frases.plataformas}`}
              tabla={plataformas.tabla}
              fuente="GET /api/metricas/plataformas"
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
            ancho="angosto"
            orden={1}
          >
            <GraficaDona
              datos={tipos.dona}
              nombreSerie="Interacciones"
              total={consultaTipos.datos?.total ?? null}
              leyendaTotal="interacciones"
              altura="330px"
              cargando={consultaTipos.cargando}
              error={consultaTipos.error}
              alReintentar={consultaTipos.reintentar}
              etiquetaAria={`Gráfica de dona con el porcentaje de interacciones de cada tipo. ${frases.tipos}`}
              tabla={tipos.tabla}
              fuente="GET /api/metricas/tipos"
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-actividad"
            titulo="Actividad por día y hora"
            subtitulo={`Interacciones por hora de cada día de la semana, en hora ${consultaActividad.datos?.zona_horaria || 'UTC'}. La celda con más interacciones lleva contorno.`}
            resumen={frases.actividad}
            esperandoResumen={consultaActividad.cargando}
            ancho="completo"
          >
            <GraficaMapaCalor
              etiquetasHorizontal={actividad.horizontal}
              etiquetasVertical={actividad.vertical}
              tituloHorizontal={actividad.titulo}
              nombreMetrica="Interacciones"
              celdas={actividad.celdas}
              gama={tema.gamaActividad}
              altura={`${actividad.filas * ALTO_FILA_CALOR + 110}px`}
              cargando={consultaActividad.cargando}
              error={consultaActividad.error}
              alReintentar={consultaActividad.reintentar}
              etiquetaAria={`Mapa de calor. Eje horizontal: hora del día; eje vertical: día de la semana; color: número de interacciones. ${frases.actividad}`}
              tabla={actividad.tabla}
              fuente="GET /api/metricas/actividad"
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-temas"
            titulo="Temas"
            subtitulo={
              vistaTemas === 'sentimiento'
                ? 'Sentimiento promedio por tema, de -1 (rojo, negativo) a 1 (verde, positivo).'
                : 'Interacciones por tema, en número de registros.'
            }
            resumen={frases.temas}
            esperandoResumen={consultaTemas.cargando || esperandoNombresCatalogo}
            orden={0}
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
              altura="340px"
              cargando={consultaTemas.cargando || esperandoNombresCatalogo}
              error={consultaTemas.error}
              alReintentar={consultaTemas.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: temas; eje horizontal: ${
                vistaTemas === 'sentimiento' ? 'sentimiento promedio' : 'número de interacciones'
              }. ${frases.temas}`}
              tabla={temas.tabla}
              fuente="GET /api/metricas/temas"
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
            orden={1}
          >
            <GraficaBarras
              categorias={etiquetas.categorias}
              series={etiquetas.series}
              horizontal
              altura="340px"
              cargando={consultaEtiquetas.cargando}
              error={consultaEtiquetas.error}
              alReintentar={consultaEtiquetas.reintentar}
              etiquetaAria={`Gráfica de barras horizontales. Eje vertical: etiquetas; eje horizontal: número de interacciones. ${frases.etiquetas}`}
              tabla={etiquetas.tabla}
              fuente="GET /api/metricas/etiquetas"
            />
          </TarjetaSeccion>
        </div>
      </section>

      {/* Geografía: solo usuarios con consentimiento ---------------------------------- */}
      <section id="grupo-geografia" className="grupo" aria-labelledby="grupo-geografia-titulo">
        <EncabezadoGrupo id="grupo-geografia" titulo="Geografía." complemento="Solo usuarios con consentimiento." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-puntos-calientes"
            titulo="Puntos calientes"
            subtitulo={`Usuarios por cuadro de ${pc?.tamano_cuadro ?? 0.2}° (unos 22 km por lado). De lejos, cada cuadro es una burbuja; desde el zoom 7 se ve el cuadro exacto. Selecciona uno para ver cuántos usuarios tiene.`}
            resumen={frases.puntos}
            esperandoResumen={consultaPuntosCalientes.cargando}
            insignias={['Solo con consentimiento', `Cuadros con ${pc?.minimo_por_cuadro ?? 3} usuarios o más`]}
            ancho="completo"
          >
            <MapaPuntosCalientes
              datos={pc?.datos ?? null}
              tamanoCuadro={pc?.tamano_cuadro ?? 0.2}
              altura="480px"
              cargando={consultaPuntosCalientes.cargando}
              error={consultaPuntosCalientes.error}
              alReintentar={consultaPuntosCalientes.reintentar}
              etiquetaAria={`Mapa interactivo con cuadros de ${pc?.tamano_cuadro ?? 0.2} grados; el color y el tamaño indican cuántos usuarios hay en cada cuadro. ${frases.puntos}`}
              tabla={tablaPuntos}
              fuente="GET /api/metricas/puntos-calientes"
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
            insignias={
              consultaGeografia.datos
                ? ['Solo con consentimiento', `Grupos con ${consultaGeografia.datos.minimo_por_grupo} usuarios o más`]
                : ['Solo con consentimiento']
            }
            ancho="completo"
            accion={
              <ControlSegmentado
                etiqueta="Agrupar por"
                valor={nivelGeografia}
                alCambiar={setNivelGeografia}
                opciones={[
                  { valor: 'estados', texto: 'Estados' },
                  { valor: 'ciudades', texto: 'Ciudades' },
                ]}
              />
            }
          >
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
              fuente="GET /api/metricas/geografia"
            />
          </TarjetaSeccion>
        </div>
      </section>

      {/* Usuarios: el padrón de TiDB -------------------------------------------------- */}
      <section id="grupo-usuarios" className="grupo" aria-labelledby="grupo-usuarios-titulo">
        <EncabezadoGrupo id="grupo-usuarios" titulo="Usuarios." complemento="Cómo es el padrón." />
        <div className="bento">
          <TarjetaSeccion
            id="seccion-estatus"
            titulo="Estatus"
            subtitulo="Porcentaje del padrón según los días desde su última actividad."
            resumen={frases.estatus}
            esperandoResumen={consultaEstatus.cargando}
            ancho="tercio"
            orden={0}
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
              fuente="GET /api/metricas/estatus"
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-edad"
            titulo="Rango de edad"
            subtitulo="Usuarios por rango de edad, en años."
            resumen={frases.edad}
            esperandoResumen={consultaDemografia.cargando}
            ancho="tercio"
            orden={1}
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
              fuente="GET /api/metricas/demografia"
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-interes"
            titulo="Interés principal"
            subtitulo="Usuarios por interés principal."
            resumen={frases.interes}
            esperandoResumen={consultaDemografia.cargando}
            ancho="tercio"
            orden={2}
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
              fuente="GET /api/metricas/demografia"
            />
          </TarjetaSeccion>

          <TarjetaSeccion
            id="seccion-demografia"
            titulo="Edad e interés"
            subtitulo="Usuarios por rango de edad e interés principal. Sin datos de ubicación. La combinación más común lleva contorno."
            resumen={frases.cruce}
            esperandoResumen={consultaDemografia.cargando}
            ancho="completo"
          >
            <GraficaMapaCalor
              etiquetasHorizontal={demografia.cruce.horizontal}
              etiquetasVertical={demografia.cruce.vertical}
              tituloHorizontal="Rango de edad"
              nombreMetrica="Usuarios"
              celdas={demografia.cruce.celdas}
              gama={tema.gamaCruce}
              altura={`${filasCruce * ALTO_FILA_CALOR + 110}px`}
              cargando={consultaDemografia.cargando}
              error={consultaDemografia.error}
              alReintentar={consultaDemografia.reintentar}
              etiquetaAria={`Mapa de calor. Eje horizontal: rango de edad; eje vertical: interés principal; color: número de usuarios. ${frases.cruce}`}
              tabla={demografia.cruce.tabla}
              fuente="GET /api/metricas/demografia"
            />
          </TarjetaSeccion>
        </div>
      </section>
    </div>
  );
}
