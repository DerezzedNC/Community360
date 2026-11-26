import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaginacionTabla from '../componentes/PaginacionTabla';
import SelectorCatalogo from '../componentes/SelectorCatalogo';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import { useCatalogos } from '../contextos/ContextoCatalogos';
import {
  ErrorApi,
  consultarDetalleUsuario,
  consultarUsuarios,
} from '../servicios/api';

const LIMITE_PAGINA = 50;
const CLAVES_FILTROS = ['estatus', 'plataforma', 'especie', 'interes'];

const ETIQUETAS_ESTATUS = {
  activo: 'Activo',
  en_riesgo: 'En riesgo',
  inactivo: 'Inactivo',
};

function formatearSentimiento(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) {
    return '—';
  }
  return Number(valor).toFixed(3);
}

function formatearUbicacionCorta(ubicacion) {
  // Privacidad estricta: si ubicacion es null nunca se muestra ni deduce ubicación.
  if (!ubicacion || typeof ubicacion !== 'object') {
    return null;
  }
  return [ubicacion.ciudad, ubicacion.estado, ubicacion.pais]
    .filter(Boolean)
    .join(', ');
}

function ModalDetalleUsuario({
  idUsuario,
  alCerrar,
  obtenerNombreLegible,
}) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({
    cargando: true,
    usuario: null,
    error: '',
  });

  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        alCerrar();
      }
    }
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [alCerrar]);

  useEffect(() => {
    const controlador = new AbortController();
    setEstado({ cargando: true, usuario: null, error: '' });

    consultarDetalleUsuario(idUsuario, controlador.signal)
      .then((datos) => {
        if (!controlador.signal.aborted) {
          setEstado({ cargando: false, usuario: datos, error: '' });
        }
      })
      .catch((err) => {
        if (controlador.signal.aborted) {
          return;
        }
        if (err instanceof ErrorApi && err.codigoHttp === 404) {
          setEstado({
            cargando: false,
            usuario: null,
            error: 'Usuario no encontrado',
          });
          return;
        }
        const mensaje =
          err instanceof ErrorApi && typeof err.datos?.detail === 'string'
            ? err.datos.detail
            : 'No se pudo consultar el detalle del usuario.';
        setEstado({ cargando: false, usuario: null, error: mensaje });
      });

    return () => controlador.abort();
  }, [idUsuario, intento]);

  const u = estado.usuario;

  return (
    <div
      className="modal-fondo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-usuario"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div className="modal-tarjeta">
        <header className="modal-tarjeta__encabezado">
          <div>
            <p className="tarjeta-acceso__marca">FICHA DE CONSULTA</p>
            <h2 id="titulo-detalle-usuario" className="modal-tarjeta__titulo">
              Usuario {idUsuario}
            </h2>
          </div>
          <button
            type="button"
            className="boton-secundario"
            onClick={alCerrar}
          >
            Cerrar
          </button>
        </header>

        {estado.cargando ? (
          <div className="estado-grafica" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <p className="estado-grafica__texto">Consultando usuario…</p>
          </div>
        ) : estado.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">{estado.error}</p>
            {estado.error !== 'Usuario no encontrado' && (
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </button>
            )}
          </div>
        ) : u ? (
          <div className="detalle-usuario">
            <dl className="rejilla-detalle">
              <div className="campo-detalle">
                <dt>ID de usuario</dt>
                <dd>{u.id_usuario}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Alias</dt>
                <dd>{u.alias}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Estatus</dt>
                <dd>
                  <span
                    className={`insignia-estatus insignia-estatus--${u.estatus}`}
                  >
                    {ETIQUETAS_ESTATUS[u.estatus] || u.estatus}
                  </span>
                </dd>
              </div>
              <div className="campo-detalle">
                <dt>Plataforma</dt>
                <dd>{obtenerNombreLegible('plataforma', u.cod_plataforma)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Especie</dt>
                <dd>{obtenerNombreLegible('especie', u.cod_especie)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Interés principal</dt>
                <dd>{obtenerNombreLegible('interes', u.cod_interes)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Rango de edad</dt>
                <dd>{obtenerNombreLegible('rango_edad', u.cod_rango_edad)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Es artista</dt>
                <dd>{u.es_artista ? 'Sí' : 'No'}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Fecha de ingreso</dt>
                <dd>{u.fecha_ingreso || '—'}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Última actividad</dt>
                <dd>{u.ultima_actividad || '—'}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Mensajes (30 días)</dt>
                <dd>{u.mensajes_30d}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Reacciones (30 días)</dt>
                <dd>{u.reacciones_30d}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Eventos asistidos</dt>
                <dd>{u.eventos_asistidos}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Comisiones compradas</dt>
                <dd>{u.comisiones_compradas}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Sentimiento promedio</dt>
                <dd>{formatearSentimiento(u.sentimiento_promedio)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Comportamiento atípico</dt>
                <dd>{u.es_atipico ? 'Sí' : 'No'}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Consentimiento de datos</dt>
                <dd>{u.consentimiento_datos ? 'Otorgado' : 'No otorgado'}</dd>
              </div>
              <div className="campo-detalle campo-detalle--amplio">
                <dt>Ubicación registrada</dt>
                <dd>
                  {u.ubicacion ? (
                    <span>
                      {formatearUbicacionCorta(u.ubicacion)}
                      {u.ubicacion.zona_horaria
                        ? ` · Zona horaria: ${u.ubicacion.zona_horaria}`
                        : ''}
                    </span>
                  ) : (
                    <span className="texto-sin-consentimiento">
                      Sin consentimiento (ubicación omitida por privacidad)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function VistaUsuarios() {
  const [parametrosUrl, setParametrosUrl] = useSearchParams();
  const {
    cargandoCatalogos,
    errorCatalogos,
    reintentarCatalogos,
    obtenerNombreLegible,
  } = useCatalogos();

  const estatus = parametrosUrl.get('estatus') || '';
  const plataforma = parametrosUrl.get('plataforma') || '';
  const especie = parametrosUrl.get('especie') || '';
  const interes = parametrosUrl.get('interes') || '';

  const paginaCruda = Number(parametrosUrl.get('pagina') || '1');
  const pagina =
    Number.isInteger(paginaCruda) && paginaCruda >= 1 ? paginaCruda : 1;

  const [intentoTabla, setIntentoTabla] = useState(0);
  const [usuarioDetalleId, setUsuarioDetalleId] = useState(null);
  const [estadoTabla, setEstadoTabla] = useState({
    cargando: true,
    total: 0,
    datos: [],
    error: '',
  });

  useEffect(() => {
    const controlador = new AbortController();
    setEstadoTabla((previo) => ({ ...previo, cargando: true, error: '' }));

    consultarUsuarios(
      {
        pagina,
        limite: LIMITE_PAGINA,
        estatus,
        plataforma,
        especie,
        interes,
      },
      controlador.signal
    )
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          setEstadoTabla({
            cargando: false,
            total: Number(respuesta?.total ?? 0),
            datos: Array.isArray(respuesta?.datos) ? respuesta.datos : [],
            error: '',
          });
        }
      })
      .catch((err) => {
        if (controlador.signal.aborted) {
          return;
        }
        let mensaje =
          'No se pudo consultar el padrón de usuarios en este momento.';
        if (err instanceof ErrorApi) {
          if (err.codigoHttp === 422) {
            mensaje =
              'Uno o más parámetros de consulta en la URL no tienen un formato válido.';
          } else if (typeof err.datos?.detail === 'string') {
            mensaje = err.datos.detail;
          }
        }
        setEstadoTabla({
          cargando: false,
          total: 0,
          datos: [],
          error: mensaje,
        });
      });

    return () => controlador.abort();
  }, [pagina, estatus, plataforma, especie, interes, intentoTabla]);

  const hayFiltrosActivos = CLAVES_FILTROS.some((clave) =>
    Boolean(parametrosUrl.get(clave))
  );

  function actualizarFiltro(clave, nuevoValor) {
    const siguientes = new URLSearchParams(parametrosUrl);
    if (nuevoValor) {
      siguientes.set(clave, nuevoValor);
    } else {
      siguientes.delete(clave);
    }
    // Al cambiar un filtro se regresa siempre a la página 1
    siguientes.delete('pagina');
    setParametrosUrl(siguientes);
  }

  function cambiarPagina(nuevaPagina) {
    const siguientes = new URLSearchParams(parametrosUrl);
    if (nuevaPagina <= 1) {
      siguientes.delete('pagina');
    } else {
      siguientes.set('pagina', String(nuevaPagina));
    }
    setParametrosUrl(siguientes);
  }

  function limpiarFiltros() {
    const siguientes = new URLSearchParams();
    setParametrosUrl(siguientes);
  }

  return (
    <div className="vista-historica">
      <section
        className="zona-filtros"
        aria-label="Filtros de consulta del padrón de usuarios"
      >
        <div className="zona-filtros__encabezado">
          <div>
            <h2 className="zona-filtros__titulo">Filtros de consulta</h2>
            <p className="zona-filtros__descripcion">
              Filtros combinables sobre el padrón histórico. Al cambiar un
              filtro se regresa a la página 1.
            </p>
          </div>
          {hayFiltrosActivos && (
            <button
              type="button"
              className="boton-secundario"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="rejilla-filtros">
          <div className="control-filtro">
            <label
              htmlFor="filtro-estatus"
              className="control-filtro__etiqueta"
            >
              Estatus
            </label>
            <select
              id="filtro-estatus"
              className="control-filtro__selector"
              value={estatus}
              onChange={(e) => actualizarFiltro('estatus', e.target.value)}
            >
              <option value="">Todos los estatus</option>
              <option value="activo">Activo</option>
              <option value="en_riesgo">En riesgo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          {!cargandoCatalogos && !errorCatalogos && (
            <>
              <SelectorCatalogo
                id="filtro-plataforma"
                etiqueta="Plataforma"
                catalogo="plataforma"
                valor={plataforma}
                alCambiar={(valor) => actualizarFiltro('plataforma', valor)}
                textoTodos="Todas las plataformas"
              />

              <SelectorCatalogo
                id="filtro-especie"
                etiqueta="Especie"
                catalogo="especie"
                valor={especie}
                alCambiar={(valor) => actualizarFiltro('especie', valor)}
                textoTodos="Todas las especies"
              />

              <SelectorCatalogo
                id="filtro-interes"
                etiqueta="Interés"
                catalogo="interes"
                valor={interes}
                alCambiar={(valor) => actualizarFiltro('interes', valor)}
                textoTodos="Todos los intereses"
              />
            </>
          )}
        </div>

        {cargandoCatalogos && (
          <div className="zona-filtros__estado" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <span>Cargando catálogos para plataforma, especie e interés…</span>
          </div>
        )}

        {errorCatalogos && (
          <div
            className="zona-filtros__estado zona-filtros__estado--error"
            role="alert"
          >
            <div>
              <p className="zona-filtros__error-titulo">
                No se pudieron cargar los catálogos de filtrado
              </p>
              <p className="zona-filtros__error-detalle">{errorCatalogos}</p>
            </div>
            <button
              type="button"
              className="boton-secundario"
              onClick={reintentarCatalogos}
            >
              Reintentar
            </button>
          </div>
        )}

        {hayFiltrosActivos && (
          <div className="resumen-filtros" aria-live="polite">
            <span className="resumen-filtros__etiqueta">Filtros activos:</span>
            {estatus && (
              <span className="insignia-filtro">
                Estatus: {ETIQUETAS_ESTATUS[estatus] || estatus}
              </span>
            )}
            {plataforma && (
              <span className="insignia-filtro">
                Plataforma: {obtenerNombreLegible('plataforma', plataforma)}
              </span>
            )}
            {especie && (
              <span className="insignia-filtro">
                Especie: {obtenerNombreLegible('especie', especie)}
              </span>
            )}
            {interes && (
              <span className="insignia-filtro">
                Interés: {obtenerNombreLegible('interes', interes)}
              </span>
            )}
          </div>
        )}
      </section>

      <TarjetaSeccion
        id="seccion-usuarios"
        titulo="Padrón de usuarios"
        descripcion="Consulta de solo lectura del padrón paginado en TiDB Cloud. Los usuarios sin consentimiento de datos nunca incluyen ubicación."
        rutaApi="GET /api/usuarios"
        insigniaPrivacidad="Ubicación según consentimiento"
        anchoCompleto
      >
        {estadoTabla.cargando ? (
          <div className="estado-grafica" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <p className="estado-grafica__texto">
              Cargando padrón de usuarios…
            </p>
          </div>
        ) : estadoTabla.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">
              No se pudo cargar el padrón
            </p>
            <p className="estado-grafica__texto">{estadoTabla.error}</p>
            <button
              type="button"
              className="boton-secundario"
              onClick={() => setIntentoTabla((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : estadoTabla.datos.length === 0 ? (
          <>
            <div className="estado-grafica" role="status">
              <p className="estado-grafica__texto">
                No se encontraron usuarios con los criterios actuales.
              </p>
            </div>
            {estadoTabla.total > 0 && (
              <PaginacionTabla
                pagina={pagina}
                limite={LIMITE_PAGINA}
                total={estadoTabla.total}
                alCambiarPagina={cambiarPagina}
              />
            )}
          </>
        ) : (
          <>
            <div className="contenedor-tabla">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Alias</th>
                    <th>Estatus</th>
                    <th>Plataforma</th>
                    <th>Especie</th>
                    <th>Interés</th>
                    <th>Edad</th>
                    <th>Sentimiento</th>
                    <th>Últ. actividad</th>
                    <th>Ubicación</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoTabla.datos.map((u) => {
                    const textoUbicacion = formatearUbicacionCorta(u.ubicacion);
                    return (
                      <tr key={u.id_usuario}>
                        <td className="celda-mono">{u.id_usuario}</td>
                        <td>
                          <span className="texto-fuerte">{u.alias}</span>
                          {u.es_artista && (
                            <span className="insignia-sutil">Artista</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`insignia-estatus insignia-estatus--${u.estatus}`}
                          >
                            {ETIQUETAS_ESTATUS[u.estatus] || u.estatus}
                          </span>
                        </td>
                        <td>
                          {obtenerNombreLegible('plataforma', u.cod_plataforma)}
                        </td>
                        <td>
                          {obtenerNombreLegible('especie', u.cod_especie)}
                        </td>
                        <td>
                          {obtenerNombreLegible('interes', u.cod_interes)}
                        </td>
                        <td>
                          {obtenerNombreLegible('rango_edad', u.cod_rango_edad)}
                        </td>
                        <td className="celda-numero">
                          {formatearSentimiento(u.sentimiento_promedio)}
                        </td>
                        <td className="celda-mono">
                          {u.ultima_actividad || '—'}
                        </td>
                        <td>
                          {textoUbicacion ? (
                            <span>{textoUbicacion}</span>
                          ) : (
                            <span className="texto-sin-consentimiento">
                              Sin consentimiento
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-enlace-tabla"
                            onClick={() => setUsuarioDetalleId(u.id_usuario)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginacionTabla
              pagina={pagina}
              limite={LIMITE_PAGINA}
              total={estadoTabla.total}
              alCambiarPagina={cambiarPagina}
              deshabilitado={estadoTabla.cargando}
            />
          </>
        )}
      </TarjetaSeccion>

      {usuarioDetalleId && (
        <ModalDetalleUsuario
          idUsuario={usuarioDetalleId}
          alCerrar={() => setUsuarioDetalleId(null)}
          obtenerNombreLegible={obtenerNombreLegible}
        />
      )}
    </div>
  );
}
