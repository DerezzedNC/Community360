import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ErrorApi,
  consultarSesionActual,
  iniciarSesion,
} from '../servicios/api';

export default function PaginaLogin() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(null);

  // Si ya existe una sesión válida en cookie httpOnly, redirige a /dashboard
  useEffect(() => {
    const controlador = new AbortController();
    setVerificandoSesion(true);

    consultarSesionActual(controlador.signal)
      .then(() => {
        if (!controlador.signal.aborted) {
          navegar('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        if (!controlador.signal.aborted) {
          setVerificandoSesion(false);
        }
      });

    return () => controlador.abort();
  }, [ubicacion.key, navegar]);

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (enviando) {
      return;
    }

    const correoNormalizado = correo.trim().toLowerCase();
    if (!correoNormalizado || !password) {
      setAlerta({
        tipo: 'error',
        mensaje: 'Ingresa tu correo electrónico y tu contraseña.',
      });
      return;
    }

    setEnviando(true);
    setAlerta(null);

    try {
      await iniciarSesion({ correo: correoNormalizado, password });
      setPassword('');
      navegar('/dashboard', { replace: true });
    } catch (error) {
      // Nunca se imprime el error, la contraseña ni el cuerpo en consola.
      if (error instanceof ErrorApi) {
        if (error.codigoHttp === 401) {
          setAlerta({
            tipo: 'error',
            mensaje: error.message,
          });
        } else if (error.codigoHttp === 422) {
          setAlerta({
            tipo: 'error',
            mensaje:
              'Revisa el formato de los datos: ingresa un correo válido (sin acentos ni ñ) y una contraseña válida.',
          });
        } else if (error.codigoHttp === 503) {
          const detalleServicio =
            typeof error.datos?.detail === 'string'
              ? error.datos.detail
              : 'Servicio temporalmente no disponible';
          setAlerta({
            tipo: 'servicio',
            mensaje: `${detalleServicio}. No es un fallo de contraseña; intenta nuevamente en unos momentos.`,
          });
        } else if (error.codigoHttp >= 500) {
          setAlerta({
            tipo: 'servicio',
            mensaje:
              'No se pudo comunicar con la API de autenticación. Verifica que el backend esté activo en el puerto 8000.',
          });
        } else {
          setAlerta({
            tipo: 'error',
            mensaje: error.message || 'No fue posible iniciar sesión.',
          });
        }
      } else {
        setAlerta({
          tipo: 'servicio',
          mensaje:
            'Sin conexión con el servidor. Verifica que el backend esté en ejecución.',
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (verificandoSesion) {
    return (
      <main className="contenedor-centrado">
        <section className="tarjeta-estado" role="status" aria-live="polite">
          <span className="indicador-carga" aria-hidden="true" />
          <h1 className="tarjeta-estado__titulo">Verificando sesión…</h1>
          <p className="tarjeta-estado__texto">
            Comprobando si ya tienes una sesión activa.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="contenedor-centrado">
      <section className="tarjeta-acceso" aria-labelledby="titulo-login">
        <div className="tarjeta-acceso__encabezado">
          <span className="marca__sigla" aria-hidden="true">
            C360
          </span>
          <div>
            <p className="tarjeta-acceso__marca">COMMUNITY 360</p>
            <h1 id="titulo-login" className="tarjeta-acceso__titulo">
              Iniciar sesión
            </h1>
          </div>
        </div>

        <p className="tarjeta-acceso__texto">
          Ingresa con una cuenta autorizada para consultar el panel analítico.
        </p>

        {alerta && (
          <div
            className={`alerta-acceso ${
              alerta.tipo === 'servicio'
                ? 'alerta-acceso--servicio'
                : 'alerta-acceso--error'
            }`}
            role="alert"
            aria-live="assertive"
          >
            {alerta.mensaje}
          </div>
        )}

        <form
          className="formulario-acceso"
          method="post"
          onSubmit={manejarEnvio}
          noValidate
        >
          <div className="campo-formulario">
            <label htmlFor="campo-correo" className="campo-formulario__etiqueta">
              Correo electrónico
            </label>
            <input
              id="campo-correo"
              name="correo"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="correo@ejemplo.mx"
              className="campo-formulario__entrada"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={enviando}
              required
            />
          </div>

          <div className="campo-formulario">
            <label
              htmlFor="campo-password"
              className="campo-formulario__etiqueta"
            >
              Contraseña
            </label>
            <input
              id="campo-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              placeholder="Ingresa tu contraseña"
              className="campo-formulario__entrada"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={enviando}
              required
            />
          </div>

          <button
            type="submit"
            className="boton-primario"
            disabled={enviando}
          >
            {enviando ? 'Validando acceso…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="tarjeta-acceso__nota">
          Panel de solo lectura · Sesión protegida mediante cookie segura
        </p>
      </section>
    </main>
  );
}
