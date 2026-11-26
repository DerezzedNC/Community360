import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EstadoVacio from '../componentes/EstadoVacio';
import HojaModal from '../componentes/HojaModal';
import PaginacionTabla from '../componentes/PaginacionTabla';
import TarjetaSeccion from '../componentes/TarjetaSeccion';
import { ErrorApi, consultarCuarentena } from '../servicios/api';
import { formatearFechaHoraUtc, recortarId } from '../utilidades/formato';

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
  return (
    <HojaModal
      idTitulo="titulo-detalle-cuarentena"
      antetitulo="Registro en cuarentena"
      titulo={<span className="celda-id">{elemento.id_cuarentena}</span>}
      alCerrar={alCerrar}
      lateral
    >
        <dl className="rejilla-detalle">
          <div className="campo-detalle">
            <dt>ID original</dt>
            <dd className="celda-id">{elemento.id_original || '—'}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Tipo de registro</dt>
            <dd>{elemento.tipo_registro || '—'}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Detectado</dt>
            <dd>{formatearFechaHoraUtc(elemento.detectado_en)}</dd>
          </div>
          <div className="campo-detalle">
            <dt>Fuente y estado de revisión</dt>
            <dd>
              {elemento.fuente || '—'}, {elemento.estado_revision || '—'}
            </dd>
          </div>
          <div className="campo-detalle campo-detalle--amplio">
            <dt>ID de lote</dt>
            <dd className="celda-id">{elemento.id_lote || '—'}</dd>
          </div>
          <div className="campo-detalle campo-detalle--amplio">
            <dt>Motivos de rechazo</dt>
            <dd className="grupo-motivos">
              {Array.isArray(elemento.motivos) && elemento.motivos.length > 0
                ? elemento.motivos.map((m) => (
                    <span key={m} className={`insignia-motivo motivo--${m}`}>
                      {MAPA_MOTIVOS[m] || m}
                    </span>
                  ))
                : '—'}
            </dd>
          </div>
        </dl>

        <div>
          <p className="etiqueta-bloque-json">
            Documento original, tal como lo devuelve la API y sin datos de ubicación.
          </p>
          <pre className="bloque-json" tabIndex={0}>
            {JSON.stringify(elemento.registro ?? {}, null, 2)}
          </pre>
        </div>
    </HojaModal>
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
  const [filaElegida, setFilaElegida] = useState(null);
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
    <div className="pagina">
      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">
          Cuarentena. <span className="titulo-pagina__complemento">Registros que la validación rechazó.</span>
        </h1>
        <p className="nota">
          {estado.cargando
            ? 'Consultando la cuarentena…'
            : estado.error
              ? 'No se pudo consultar la cuarentena.'
              : `${estado.total.toLocaleString('es-MX')} ${estado.total === 1 ? 'registro' : 'registros'}${motivo ? ' con este motivo' : ' en total'}, del más reciente al más antiguo.`}
        </p>
      </header>

      <section className="tarjeta tarjeta--completo zona-filtros" aria-labelledby="titulo-filtro-motivo">
        <div className="zona-filtros__encabezado">
          <div>
            <h2 id="titulo-filtro-motivo" className="tarjeta__titulo">Filtro</h2>
            <p className="tarjeta__subtitulo">Muestra solo los registros con un motivo de rechazo.</p>
          </div>
          {motivo && (
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => cambiarMotivo('')}
            >
              Quitar filtro
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
        titulo="Registros"
        subtitulo="El documento original se muestra sin datos de ubicación."
        insignias={['Sin ubicación']}
        fuente="GET /api/cuarentena"
        nivelTitulo={2}
        ancho="completo"
      >
        {estado.cargando ? (
          <div className="esqueleto esqueleto--tabla" role="status" aria-live="polite">
            <span className="sr-only">Cargando registros</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span key={n} className="esqueleto-fila" aria-hidden="true" />
            ))}
          </div>
        ) : estado.error ? (
          <div className="estado-grafica estado-grafica--error" role="alert">
            <p className="estado-grafica__titulo">No se pudo cargar la cuarentena.</p>
            <p className="estado-grafica__texto">
              {estado.error.replace(/\.$/, '')}. Revisa la conexión y elige Reintentar.
            </p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setIntento((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : estado.datos.length === 0 ? (
          <>
            <EstadoVacio
              titulo={motivo ? 'No hay registros con este motivo.' : 'No hay registros en esta página.'}
              texto={motivo ? 'Prueba con otro motivo o quita el filtro.' : 'Vuelve a la primera página.'}
              accion={
                motivo ? (
                  <button type="button" className="boton boton--secundario" onClick={() => cambiarMotivo('')}>
                    Quitar filtro
                  </button>
                ) : (
                  estado.total > 0 && (
                    <button type="button" className="boton boton--secundario" onClick={() => cambiarPagina(1)}>
                      Ir a la primera página
                    </button>
                  )
                )
              }
            />
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
                    <th scope="col">ID</th>
                    <th scope="col">ID original</th>
                    <th scope="col">Motivos</th>
                    <th scope="col">Detectado</th>
                    <th scope="col">Fuente</th>
                    <th scope="col">Revisión</th>
                    <th scope="col"><span className="sr-only">Registro</span></th>
                  </tr>
                </thead>
                <tbody>
                  {estado.datos.map((fila) => (
                    <tr
                      key={fila.id_cuarentena}
                      className={filaElegida === fila.id_cuarentena ? 'fila--elegida' : undefined}
                    >
                      <td className="celda-id" title={fila.id_cuarentena}>{recortarId(fila.id_cuarentena)}</td>
                      <td className="celda-id" title={fila.id_original || undefined}>{fila.id_original ? recortarId(fila.id_original) : '—'}</td>
                      <td>
                        <div className="grupo-motivos">
                          {Array.isArray(fila.motivos) &&
                          fila.motivos.length > 0
                            ? fila.motivos.map((m) => (
                                <span key={m} className={`insignia-motivo motivo--${m}`}>
                                  {MAPA_MOTIVOS[m] || m}
                                </span>
                              ))
                            : '—'}
                        </div>
                      </td>
                      <td className="celda-fecha">{formatearFechaHoraUtc(fila.detectado_en)}</td>
                      <td>{fila.fuente || '—'}</td>
                      <td>{fila.estado_revision || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="boton-enlace"
                          onClick={() => {
                            setFilaElegida(fila.id_cuarentena);
                            setSeleccionado(fila);
                          }}
                          aria-label={`Ver registro ${fila.id_cuarentena}`}
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
