import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Avatar from '../componentes/Avatar';
import EstadoVacio from '../componentes/EstadoVacio';
import HojaModal from '../componentes/HojaModal';
import PaginacionTabla from '../componentes/PaginacionTabla';
import SelectorCatalogo from '../componentes/SelectorCatalogo';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import { useCatalogos } from '../contextos/ContextoCatalogos';
import {
  ErrorApi,
  consultarDetalleUsuario,
  consultarUsuarios,
} from '../servicios/api';
import { formatearFecha, recortarId, textoVisible } from '../utilidades/formato';

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
    <HojaModal
      idTitulo="titulo-detalle-usuario"
      antetitulo="Detalle de usuario"
      titulo={u?.alias || idUsuario}
      alCerrar={alCerrar}
      lateral
    >
        {estado.cargando ? (
          <div className="esqueleto esqueleto--detalle" role="status" aria-live="polite">
            <span className="sr-only">Cargando usuario</span>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className="esqueleto-linea" aria-hidden="true" />
            ))}
          </div>
        ) : estado.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">
              {estado.error === 'Usuario no encontrado'
                ? 'Este usuario ya no está en el padrón.'
                : 'No se pudo cargar el detalle.'}
            </p>
            {estado.error !== 'Usuario no encontrado' && (
              <>
                <p className="estado-grafica__texto">
                  {textoVisible(estado.error)}. Revisa la conexión y elige Reintentar.
                </p>
                <button
                  type="button"
                  className="boton boton--secundario"
                  onClick={() => setIntento((n) => n + 1)}
                >
                  Reintentar
                </button>
              </>
            )}
          </div>
        ) : u ? (
          <div className="detalle-usuario">
            <div className="detalle-usuario__cabecera">
              <Avatar alias={u.alias} />
              <div>
                <p className="texto-fuerte">{u.alias}</p>
                <span className={`estatus estatus--${u.estatus}`}>
                  {ETIQUETAS_ESTATUS[u.estatus] || u.estatus}
                </span>
              </div>
            </div>

            <h3 className="detalle-usuario__seccion">Perfil</h3>
            <dl className="rejilla-detalle">
              <div className="campo-detalle">
                <dt>ID de usuario</dt>
                <dd className="celda-id">{u.id_usuario}</dd>
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
                <dd>{formatearFecha(u.fecha_ingreso)}</dd>
              </div>
              <div className="campo-detalle">
                <dt>Consentimiento de datos</dt>
                <dd>{u.consentimiento_datos ? 'Otorgado' : 'No otorgado'}</dd>
              </div>
            </dl>

            <h3 className="detalle-usuario__seccion">Actividad</h3>
            <dl className="rejilla-detalle">
              <div className="campo-detalle">
                <dt>Última actividad</dt>
                <dd>{formatearFecha(u.ultima_actividad)}</dd>
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
            </dl>

            {/* Privacidad: sin consentimiento no hay ubicación (la API ya la manda en null) */}
            <h3 className="detalle-usuario__seccion">{u.ubicacion ? 'Ubicación' : 'Sin consentimiento'}</h3>
            {u.ubicacion ? (
              <dl className="rejilla-detalle">
                <div className="campo-detalle campo-detalle--amplio">
                  <dt>Ciudad, estado y país</dt>
                  <dd>{formatearUbicacionCorta(u.ubicacion)}</dd>
                </div>
                {u.ubicacion.zona_horaria && (
                  <div className="campo-detalle campo-detalle--amplio">
                    <dt>Zona horaria</dt>
                    <dd>{u.ubicacion.zona_horaria}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="texto-sin-consentimiento">
                El usuario no dio su consentimiento: su ubicación no se muestra.
              </p>
            )}
          </div>
        ) : null}
    </HojaModal>
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
  const [filaElegida, setFilaElegida] = useState(null);
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
    <div className="pagina">
      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">
          Usuarios. <span className="titulo-pagina__complemento">El padrón, de solo lectura.</span>
        </h1>
        <p className="nota">
          {estadoTabla.cargando
            ? 'Consultando el padrón…'
            : estadoTabla.error
              ? 'No se pudo consultar el padrón.'
              : `${estadoTabla.total.toLocaleString('es-MX')} ${estadoTabla.total === 1 ? 'usuario' : 'usuarios'} ${hayFiltrosActivos ? 'con estos filtros' : 'en total'}.`}
        </p>
      </header>

      <section className="tarjeta tarjeta--completo zona-filtros" aria-labelledby="titulo-filtros">
        <div className="zona-filtros__encabezado">
          <div>
            <h2 id="titulo-filtros" className="tarjeta__titulo">Filtros</h2>
            <p className="tarjeta__subtitulo">
              Se combinan entre sí. Al cambiar uno, la tabla vuelve a la página 1.
            </p>
          </div>
          {hayFiltrosActivos && (
            <button
              type="button"
              className="boton boton--secundario"
              onClick={limpiarFiltros}
            >
              Quitar filtros
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
            <span>Cargando las opciones de plataforma, especie e interés…</span>
          </div>
        )}

        {errorCatalogos && (
          <div
            className="zona-filtros__estado zona-filtros__estado--error"
            role="alert"
          >
            <div>
              <p className="zona-filtros__error-titulo">
                No se pudieron cargar las opciones de plataforma, especie e interés.
              </p>
              <p className="zona-filtros__error-detalle">
                {textoVisible(errorCatalogos)}. Revisa la conexión y elige Reintentar.
              </p>
            </div>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={reintentarCatalogos}
            >
              Reintentar
            </button>
          </div>
        )}

        {hayFiltrosActivos && (
          <div className="resumen-filtros" aria-live="polite">
            <span className="resumen-filtros__etiqueta">Filtros aplicados:</span>
            {estatus && (
              <span className="insignia">
                Estatus: {ETIQUETAS_ESTATUS[estatus] || estatus}
              </span>
            )}
            {plataforma && (
              <span className="insignia">
                Plataforma: {obtenerNombreLegible('plataforma', plataforma)}
              </span>
            )}
            {especie && (
              <span className="insignia">
                Especie: {obtenerNombreLegible('especie', especie)}
              </span>
            )}
            {interes && (
              <span className="insignia">
                Interés: {obtenerNombreLegible('interes', interes)}
              </span>
            )}
          </div>
        )}
      </section>

      <TarjetaSeccion
        id="seccion-usuarios"
        titulo="Padrón"
        subtitulo="La ubicación solo aparece si el usuario dio su consentimiento, y nunca con coordenadas."
        insignias={['Ubicación solo con consentimiento']}
        nivelTitulo={2}
        ancho="completo"
      >
        {estadoTabla.cargando ? (
          <div className="esqueleto esqueleto--tabla" role="status" aria-live="polite">
            <span className="sr-only">Cargando usuarios</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span key={n} className="esqueleto-fila" aria-hidden="true" />
            ))}
          </div>
        ) : estadoTabla.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">No se pudo cargar el padrón.</p>
            <p className="estado-grafica__texto">
              {textoVisible(estadoTabla.error)}. Revisa la conexión y elige Reintentar.
            </p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setIntentoTabla((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : estadoTabla.datos.length === 0 ? (
          <>
            <EstadoVacio
              titulo={hayFiltrosActivos ? 'No hay usuarios con estos filtros.' : 'No hay usuarios en esta página.'}
              texto={hayFiltrosActivos ? 'Prueba quitando alguno.' : 'Vuelve a la primera página.'}
              accion={
                hayFiltrosActivos ? (
                  <button type="button" className="boton boton--secundario" onClick={limpiarFiltros}>
                    Quitar filtros
                  </button>
                ) : (
                  estadoTabla.total > 0 && (
                    <button type="button" className="boton boton--secundario" onClick={() => cambiarPagina(1)}>
                      Ir a la primera página
                    </button>
                  )
                )
              }
            />
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
                    <th scope="col">ID</th>
                    <th scope="col">Alias</th>
                    <th scope="col">Estatus</th>
                    <th scope="col">Plataforma</th>
                    <th scope="col">Especie</th>
                    <th scope="col">Interés</th>
                    <th scope="col">Edad</th>
                    <th scope="col" className="celda-numero">Sentimiento</th>
                    <th scope="col">Última actividad</th>
                    <th scope="col">Ubicación</th>
                    <th scope="col"><span className="sr-only">Detalle</span></th>
                  </tr>
                </thead>
                <tbody>
                  {estadoTabla.datos.map((u) => {
                    const textoUbicacion = formatearUbicacionCorta(u.ubicacion);
                    return (
                      <tr
                        key={u.id_usuario}
                        className={filaElegida === u.id_usuario ? 'fila--elegida' : undefined}
                      >
                        <td className="celda-id" title={u.id_usuario}>{recortarId(u.id_usuario)}</td>
                        <td>
                          <span className="celda-alias">
                            <Avatar alias={u.alias} />
                            <span className="celda-alias__texto">
                              <span className="texto-fuerte">{u.alias}</span>
                              {u.es_artista && (
                                <span className="insignia-sutil">Artista</span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className={`estatus estatus--${u.estatus}`}>
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
                        <td className="celda-corta">
                          {obtenerNombreLegible('rango_edad', u.cod_rango_edad)}
                        </td>
                        <td className="celda-numero">
                          {formatearSentimiento(u.sentimiento_promedio)}
                        </td>
                        <td className="celda-fecha">
                          {formatearFecha(u.ultima_actividad)}
                        </td>
                        <td>
                          {textoUbicacion ? (
                            <span className="ubicacion-dos-lineas">
                              <span>{u.ubicacion.ciudad}</span>
                              <span className="ubicacion-dos-lineas__resto">
                                {[u.ubicacion.estado, u.ubicacion.pais].filter(Boolean).join(', ')}
                              </span>
                            </span>
                          ) : (
                            <span className="texto-sin-consentimiento">
                              Sin consentimiento
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-enlace"
                            onClick={() => {
                              setFilaElegida(u.id_usuario);
                              setUsuarioDetalleId(u.id_usuario);
                            }}
                            aria-label={`Ver detalle de ${u.alias || u.id_usuario}`}
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
