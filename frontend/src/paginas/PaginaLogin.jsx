import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ErrorApi,
  consultarSesionActual,
  iniciarSesion,
} from '../servicios/api';

// Validación al salir del campo (solo presentación: el envío y sus respuestas no cambian)
const FORMATO_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function revisarCorreo(valor) {
  const texto = valor.trim();
  if (!texto) return 'Escribe tu correo.';
  if (!FORMATO_CORREO.test(texto)) return 'Revisa el correo: debe tener la forma nombre@dominio.mx, sin acentos ni ñ.';
  return '';
}

function revisarPassword(valor) {
  return valor ? '' : 'Escribe tu contraseña.';
}

export default function PaginaLogin() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const [errorCorreo, setErrorCorreo] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

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
      setErrorCorreo(revisarCorreo(correo));
      setErrorPassword(revisarPassword(password));
      setAlerta({
        tipo: 'error',
        mensaje: 'Escribe tu correo y tu contraseña.',
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
              'Revisa los datos: el correo debe tener la forma nombre@dominio.mx, sin acentos ni ñ.',
          });
        } else if (error.codigoHttp === 503) {
          const detalleServicio =
            typeof error.datos?.detail === 'string'
              ? error.datos.detail
              : 'Servicio temporalmente no disponible';
          setAlerta({
            tipo: 'servicio',
            mensaje: `${detalleServicio.replace(/\.$/, '')}. La contraseña no es el problema: espera unos segundos y elige Iniciar sesión otra vez.`,
          });
        } else if (error.codigoHttp >= 500) {
          setAlerta({
            tipo: 'servicio',
            mensaje:
              'No se pudo conectar con el servidor. Revisa que la API esté encendida en el puerto 8000 y elige Iniciar sesión otra vez.',
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
            'No se pudo conectar con el servidor. Revisa que la API esté encendida y elige Iniciar sesión otra vez.',
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
          <h1 className="tarjeta-estado__titulo">Comprobando la sesión…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="contenedor-centrado">
      <section className="tarjeta-acceso" aria-labelledby="titulo-login">
        <p className="tarjeta-acceso__marca">COMMUNITY 360</p>
        <h1 id="titulo-login" className="tarjeta-acceso__titulo">
          Inicia sesión. <span className="tarjeta-acceso__complemento">Usa tu cuenta de administración o de análisis.</span>
        </h1>

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
              onChange={(e) => {
                setCorreo(e.target.value);
                if (errorCorreo) setErrorCorreo(revisarCorreo(e.target.value));
              }}
              onBlur={() => setErrorCorreo(revisarCorreo(correo))}
              aria-invalid={errorCorreo ? true : undefined}
              aria-describedby={errorCorreo ? 'error-correo' : undefined}
              disabled={enviando}
              required
            />
            {errorCorreo && (
              <p id="error-correo" className="campo-formulario__error">
                {errorCorreo}
              </p>
            )}
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
              placeholder="Tu contraseña"
              className="campo-formulario__entrada"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorPassword) setErrorPassword(revisarPassword(e.target.value));
              }}
              onBlur={() => setErrorPassword(revisarPassword(password))}
              aria-invalid={errorPassword ? true : undefined}
              aria-describedby={errorPassword ? 'error-password' : undefined}
              disabled={enviando}
              required
            />
            {errorPassword && (
              <p id="error-password" className="campo-formulario__error">
                {errorPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="boton boton--primario boton--ancho"
            disabled={enviando}
          >
            {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="tarjeta-acceso__nota">
          El panel es de solo lectura. La sesión se guarda en una cookie segura y dura 60 minutos.
        </p>
      </section>
    </main>
  );
}
