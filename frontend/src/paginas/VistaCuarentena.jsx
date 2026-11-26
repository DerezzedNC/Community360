import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaginacionTabla from '../componentes/PaginacionTabla';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import { ErrorApi, consultarCuarentena } from '../servicios/api';

const LIMITE_PAGINA = 50;

// Valores permitidos por el Contrato v0.9 para GET /api/cuarentena?motivo=...
const MOTIVOS_CONTRATO = [
  { codigo: 'duplicado', etiqueta: 'Duplicado' },
  { codigo: 'tipo_dato_invalido', etiqueta: 'Tipo de dato inválido' },
  { codigo: 'categoria_invalida', etiqueta: 'Categoría inválida' },
  { codigo: 'usuario_inexistente', etiqueta: 'Usuario inexistente' },
  {
    codigo: 'fecha_anterior_ingreso',
    etiqueta: 'Fecha anterior al ingreso',
  },
];

const MAPA_MOTIVOS = Object.fromEntries(
  MOTIVOS_CONTRATO.map((m) => [m.codigo, m.etiqueta])
);

function ModalRegistroCuarentena({ elemento, alCerrar }) {
  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        alCerrar();
      }
    }
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [alCerrar]);

  return (
    <div
      className="modal-fondo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-cuarentena"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div className="modal-tarjeta">
        <header className="modal-tarjeta__encabezado">
          <div>
            <p className="tarjeta-acceso__marca">REGISTRO EN CUARENTENA</p>
            <h2
              id="titulo-detalle-cuarentena"
              className="modal-tarjeta__titulo"
            >
              {elemento.id_cuarentena}
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

        <dl className="rejilla-detalle">
          <div className="campo-detalle">
            <dt>ID original</dt>
            <dd className="celda-mono">{elemento.id_original || '—'}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Tipo de registro</dt>
            <dd>{elemento.tipo_registro || '—'}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Detectado en (UTC)</dt>
            <dd className="celda-mono">{elemento.detectado_en || '—'}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Fuente / Estado</dt>
            <dd>
              {elemento.fuente || '—'} · {elemento.estado_revision || '—'}
            </dd>
          </div>
          <div className="campo-detalle campo-detalle--amplio">
            <dt>ID de lote</dt>
            <dd className="celda-mono">{elemento.id_lote || '—'}</dd>
          </div>
          <div className="campo-detalle campo-detalle--amplio">
            <dt>Motivos de rechazo</dt>
            <dd className="grupo-motivos">
              {Array.isArray(elemento.motivos) && elemento.motivos.length > 0
                ? elemento.motivos.map((m) => (
                    <span key={m} className="insignia-motivo">
                      {MAPA_MOTIVOS[m] || m}
                    </span>
                  ))
                : '—'}
            </dd>
          </div>
        </dl>

        <div>
          <p className="etiqueta-bloque-json">
            Documento original (mostrado tal cual llega de la API, sin campos
            geográficos):
          </p>
          <pre className="bloque-json">
            {JSON.stringify(elemento.registro ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function VistaCuarentena() {
  const [parametrosUrl, setParametrosUrl] = useSearchParams();
  const motivo = parametrosUrl.get('motivo') || '';
  const paginaCruda = Number(parametrosUrl.get('pagina') || '1');
  const pagina =
    Number.isInteger(paginaCruda) && paginaCruda >= 1 ? paginaCruda : 1;

  const [intento, setIntento] = useState(0);
  const [seleccionado, setSeleccionado] = useState(null);
  const [estado, setEstado] = useState({
    cargando: true,
    total: 0,
    datos: [],
    error: '',
  });

  useEffect(() => {
    const controlador = new AbortController();
    setEstado((previo) => ({ ...previo, cargando: true, error: '' }));

    consultarCuarentena(
      {
        pagina,
        limite: LIMITE_PAGINA,
        motivo,
      },
      controlador.signal
    )
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          setEstado({
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
          'No se pudieron consultar los registros en cuarentena.';
        if (err instanceof ErrorApi) {
          if (err.codigoHttp === 422) {
            mensaje =
              'El filtro de motivo en la URL no corresponde a un valor válido del contrato.';
          } else if (typeof err.datos?.detail === 'string') {
            mensaje = err.datos.detail;
          }
        }
        setEstado({
          cargando: false,
          total: 0,
          datos: [],
          error: mensaje,
        });
      });

    return () => controlador.abort();
  }, [pagina, motivo, intento]);

  function cambiarMotivo(nuevoMotivo) {
    const siguientes = new URLSearchParams(parametrosUrl);
    if (nuevoMotivo) {
      siguientes.set('motivo', nuevoMotivo);
    } else {
      siguientes.delete('motivo');
    }
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

  return (
    <div className="vista-historica">
      <section
        className="zona-filtros"
        aria-label="Filtro de registros en cuarentena"
      >
        <div className="zona-filtros__encabezado">
          <div>
            <h2 className="zona-filtros__titulo">Filtro por motivo</h2>
            <p className="zona-filtros__descripcion">
              Consulta de solo lectura ordenada del registro más reciente al más
              antiguo.
            </p>
          </div>
          {motivo && (
            <button
              type="button"
              className="boton-secundario"
              onClick={() => cambiarMotivo('')}
            >
              Limpiar filtro
            </button>
          )}
        </div>

        <div className="rejilla-filtros">
          <div className="control-filtro">
            <label htmlFor="filtro-motivo" className="control-filtro__etiqueta">
              Motivo de rechazo
            </label>
            <select
              id="filtro-motivo"
              className="control-filtro__selector"
              value={motivo}
              onChange={(e) => cambiarMotivo(e.target.value)}
            >
              <option value="">Todos los motivos</option>
              {MOTIVOS_CONTRATO.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <TarjetaSeccion
        id="seccion-cuarentena"
        titulo="Cuarentena"
        descripcion="Registros rechazados por el proceso de validación en Couchbase Capella. El documento original se presenta sin campos geográficos."
        rutaApi="GET /api/cuarentena"
        insigniaPrivacidad="Sin geografía"
        anchoCompleto
      >
        {estado.cargando ? (
          <div className="estado-grafica" role="status" aria-live="polite">
            <span className="indicador-carga" aria-hidden="true" />
            <p className="estado-grafica__texto">
              Cargando registros en cuarentena…
            </p>
          </div>
        ) : estado.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">
              No se pudo cargar la cuarentena
            </p>
            <p className="estado-grafica__texto">{estado.error}</p>
            <button
              type="button"
              className="boton-secundario"
              onClick={() => setIntento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : estado.datos.length === 0 ? (
          <>
            <div className="estado-grafica" role="status">
              <p className="estado-grafica__texto">
                No se encontraron registros en cuarentena para este criterio.
              </p>
            </div>
            {estado.total > 0 && (
              <PaginacionTabla
                pagina={pagina}
                limite={LIMITE_PAGINA}
                total={estado.total}
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
                    <th>ID cuarentena</th>
                    <th>ID original</th>
                    <th>Motivos</th>
                    <th>Detectado en (UTC)</th>
                    <th>Fuente</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {estado.datos.map((fila) => (
                    <tr key={fila.id_cuarentena}>
                      <td className="celda-mono">{fila.id_cuarentena}</td>
                      <td className="celda-mono">{fila.id_original || '—'}</td>
                      <td>
                        <div className="grupo-motivos">
                          {Array.isArray(fila.motivos) &&
                          fila.motivos.length > 0
                            ? fila.motivos.map((m) => (
                                <span key={m} className="insignia-motivo">
                                  {MAPA_MOTIVOS[m] || m}
                                </span>
                              ))
                            : '—'}
                        </div>
                      </td>
                      <td className="celda-mono">{fila.detectado_en || '—'}</td>
                      <td>{fila.fuente || '—'}</td>
                      <td>{fila.estado_revision || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="boton-enlace-tabla"
                          onClick={() => setSeleccionado(fila)}
                        >
                          Ver registro
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginacionTabla
              pagina={pagina}
              limite={LIMITE_PAGINA}
              total={estado.total}
              alCambiarPagina={cambiarPagina}
              deshabilitado={estado.cargando}
            />
          </>
        )}
      </TarjetaSeccion>

      {seleccionado && (
        <ModalRegistroCuarentena
          elemento={seleccionado}
          alCerrar={() => setSeleccionado(null)}
        />
      )}
    </div>
  );
}
