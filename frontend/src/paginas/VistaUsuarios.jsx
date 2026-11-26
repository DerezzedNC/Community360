import { useSearchParams } from 'react-router-dom';
import SelectorCatalogo from '../componentes/SelectorCatalogo';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import { useCatalogos } from '../contextos/ContextoCatalogos';

const PARAMETROS_CATALOGO = ['plataforma', 'especie', 'interes'];

export default function VistaUsuarios() {
  const [parametrosUrl, setParametrosUrl] = useSearchParams();
  const {
    cargandoCatalogos,
    errorCatalogos,
    reintentarCatalogos,
    obtenerNombreLegible,
  } = useCatalogos();

  const plataforma = parametrosUrl.get('plataforma') || '';
  const especie = parametrosUrl.get('especie') || '';
  const interes = parametrosUrl.get('interes') || '';

  const hayFiltrosActivos = PARAMETROS_CATALOGO.some((clave) =>
    Boolean(parametrosUrl.get(clave))
  );

  function actualizarFiltro(clave, nuevoValor) {
    const siguientes = new URLSearchParams(parametrosUrl);
    if (nuevoValor) {
      siguientes.set(clave, nuevoValor);
    } else {
      siguientes.delete(clave);
    }
    siguientes.delete('pagina');
    setParametrosUrl(siguientes);
  }

  function limpiarFiltros() {
    const siguientes = new URLSearchParams(parametrosUrl);
    for (const clave of PARAMETROS_CATALOGO) {
      siguientes.delete(clave);
    }
    siguientes.delete('pagina');
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
              Opciones cargadas en tiempo real desde{' '}
              <code>GET /api/catalogos</code> (únicamente códigos activos).
            </p>
          </div>
          {hayFiltrosActivos && !errorCatalogos && (
            <button
              type="button"
              className="boton-secundario"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {cargandoCatalogos ? (
          <div className="zona-filtros__estado" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <span>Cargando catálogos para los filtros…</span>
          </div>
        ) : errorCatalogos ? (
          <div
            className="zona-filtros__estado zona-filtros__estado--error"
            role="alert"
          >
            <div>
              <p className="zona-filtros__error-titulo">
                No se pudieron cargar las opciones de filtrado
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
        ) : (
          <>
            <div className="rejilla-filtros">
              <div className="control-filtro">
                <label
                  htmlFor="filtro-estatus-pendiente"
                  className="control-filtro__etiqueta"
                >
                  Estatus
                </label>
                <select
                  id="filtro-estatus-pendiente"
                  className="control-filtro__selector"
                  value=""
                  disabled
                  aria-describedby="nota-estatus-pendiente"
                >
                  <option value="">Pendiente de contrato v0.6</option>
                </select>
              </div>

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
            </div>

            {hayFiltrosActivos && (
              <div className="resumen-filtros" aria-live="polite">
                <span className="resumen-filtros__etiqueta">
                  Parámetros activos en URL:
                </span>
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
          </>
        )}
      </section>

      <TarjetaSeccion
        id="seccion-usuarios"
        titulo="Padrón de usuarios"
        descripcion="Consulta de solo lectura del padrón paginado y su detalle, respetando la omisión de ubicación sin consentimiento."
        rutaApi="GET /api/usuarios"
        insigniaPrivacidad="Ubicación según consentimiento"
        anchoCompleto
        pendienteConexion
      />
    </div>
  );
}
