import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorApi, consultarSesionActual } from '../servicios/api';

export default function RutaProtegida() {
  const ubicacion = useLocation();
  const [intento, setIntento] = useState(0);
  const [consulta, setConsulta] = useState({
    estado: 'verificando',
    usuario: null,
    mensaje: '',
  });

  // Escucha restauraciones desde bfcache (botón Atrás) y 401 en cualquier petición protegida
  useEffect(() => {
    function manejarMostrarPagina(evento) {
      if (evento.persisted) {
        setConsulta({
          estado: 'verificando',
          usuario: null,
          mensaje: '',
        });
        setIntento((previo) => previo + 1);
      }
    }

    function manejarSesionExpirada() {
      setConsulta({
        estado: 'no_autenticado',
        usuario: null,
        mensaje: '',
      });
    }

    window.addEventListener('pageshow', manejarMostrarPagina);
    window.addEventListener('c360:sesion-expirada', manejarSesionExpirada);
    return () => {
      window.removeEventListener('pageshow', manejarMostrarPagina);
      window.removeEventListener('c360:sesion-expirada', manejarSesionExpirada);
    };
  }, []);

  // Comprueba GET /api/auth/me al entrar a /dashboard* y en cada cambio de ruta interna
  useEffect(() => {
    const controlador = new AbortController();

    setConsulta((previo) =>
      previo.estado === 'autenticado'
        ? previo
        : { estado: 'verificando', usuario: null, mensaje: '' }
    );

    consultarSesionActual(controlador.signal)
      .then((usuario) => {
        if (!controlador.signal.aborted) {
          setConsulta({
            estado: 'autenticado',
            usuario,
            mensaje: '',
          });
        }
      })
      .catch((error) => {
        if (controlador.signal.aborted) {
          return;
        }

        if (error instanceof ErrorApi && error.codigoHttp === 401) {
          setConsulta({
            estado: 'no_autenticado',
            usuario: null,
            mensaje: '',
          });
          return;
        }

        const detalle =
          error instanceof ErrorApi && typeof error.datos?.detail === 'string'
            ? error.datos.detail
            : 'No se pudo comprobar la sesión porque el servidor o la base de datos no responde en este momento.';

        setConsulta((previo) =>
          previo.estado === 'autenticado'
            ? previo
            : {
                estado: 'error_servicio',
                usuario: null,
                mensaje: detalle,
              }
        );
      });

    return () => controlador.abort();
  }, [ubicacion.pathname, intento]);

  if (consulta.estado === 'verificando') {
    return (
      <main className="contenedor-centrado">
        <section className="tarjeta-estado" role="status" aria-live="polite">
          <span className="indicador-carga" aria-hidden="true" />
          <h1 className="tarjeta-estado__titulo">Verificando sesión…</h1>
          <p className="tarjeta-estado__texto">
            Comprobando tu acceso con el servidor de COMMUNITY 360.
          </p>
        </section>
      </main>
    );
  }

  if (consulta.estado === 'no_autenticado') {
    return <Navigate to="/login" replace />;
  }

  if (consulta.estado === 'error_servicio') {
    return (
      <main className="contenedor-centrado">
        <section className="tarjeta-estado" role="alert">
          <p className="tarjeta-acceso__marca">COMMUNITY 360</p>
          <h1 className="tarjeta-estado__titulo">
            Servicio temporalmente no disponible
          </h1>
          <p className="tarjeta-estado__texto">
            {consulta.mensaje}. Tu sesión no se ha cerrado.
          </p>
          <button
            type="button"
            className="boton-primario"
            onClick={() => setIntento((previo) => previo + 1)}
          >
            Reintentar conexión
          </button>
        </section>
      </main>
    );
  }

  return <Outlet context={{ usuario: consulta.usuario }} />;
}
