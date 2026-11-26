import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Aurora from '../componentes/Aurora';
import { IconoCandado, IconoEnVivo, IconoEscudo, IconoOjo } from '../componentes/Iconos';
import {
  ErrorApi,
  consultarSalud,
  consultarSesionActual,
  iniciarSesion,
} from '../servicios/api';
import { textoVisible } from '../utilidades/formato';

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

// Píldora de estado real con GET /api/health (pública): verde si responde, gris si no
function PildoraServicios() {
  const [salud, setSalud] = useState(undefined);
  useEffect(() => {
    const controlador = new AbortController();
    consultarSalud(controlador.signal)
      .then((datos) => setSalud(datos || null))
      .catch(() => {
        if (!controlador.signal.aborted) setSalud(null);
      });
    return () => controlador.abort();
  }, []);

  const estado = (activo) => (salud === undefined ? 'consultando' : activo ? 'ok' : 'apagado');
  const texto = (activo) => (salud === undefined ? 'comprobando' : activo ? 'responde' : 'sin respuesta');
  return (
    <p className="pildora-servicios" role="status" aria-live="polite">
      <span>Servicios:</span>
      <span className={`pildora-servicios__item pildora-servicios__item--${estado(salud?.tidb)}`}>
        Usuarios <span className="pildora-servicios__punto" aria-hidden="true" />
        <span className="sr-only">{texto(salud?.tidb)}</span>
      </span>
      <span className={`pildora-servicios__item pildora-servicios__item--${estado(salud?.capella)}`}>
        Interacciones <span className="pildora-servicios__punto" aria-hidden="true" />
        <span className="sr-only">{texto(salud?.capella)}</span>
      </span>
    </p>
  );
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
  const [verPassword, setVerPassword] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [sacudir, setSacudir] = useState(0); // cambia para repetir la sacudida del error

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

  function revisarMayusculas(evento) {
    if (typeof evento.getModifierState === 'function') {
      setMayusculas(evento.getModifierState('CapsLock'));
    }
  }

  // Cada alerta nueva sacude brevemente la tarjeta (sin movimiento si se pide reducirlo)
  useEffect(() => {
    if (alerta) setSacudir((n) => n + 1);
  }, [alerta]);

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
            mensaje: `${textoVisible(detalleServicio, 'El servicio no está disponible')}. La contraseña no es el problema: espera unos segundos y elige Iniciar sesión otra vez.`,
          });
        } else if (error.codigoHttp >= 500) {
          setAlerta({
            tipo: 'servicio',
            mensaje:
              'No se pudo conectar con el servidor. Revisa que esté encendido y elige Iniciar sesión otra vez.',
          });
        } else {
          setAlerta({
            tipo: 'error',
            mensaje: `${textoVisible(error.message, 'No fue posible iniciar sesión')}.`,
          });
        }
      } else {
        setAlerta({
          tipo: 'servicio',
          mensaje:
            'No se pudo conectar con el servidor. Revisa que esté encendido y elige Iniciar sesión otra vez.',
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (verificandoSesion) {
    return (
      <main className="contenedor-centrado contenedor-centrado--aurora">
        <Aurora />
        <section className="tarjeta-estado" role="status" aria-live="polite">
          <span className="indicador-carga" aria-hidden="true" />
          <h1 className="tarjeta-estado__titulo">Comprobando la sesión…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="acceso">
      <Aurora />
      <section className="acceso__presentacion" aria-label="Presentación">
        <p className="acceso__marca-titulo">
          COMMUNITY 360. <span className="acceso__marca-complemento">Tu comunidad, en tiempo real.</span>
        </p>
        <ul className="acceso__puntos">
          <li>
            <IconoEnVivo />
            <span>
              <strong>En vivo.</strong> Los cambios llegan solos, sin recargar.
            </span>
          </li>
          <li>
            <IconoEscudo />
            <span>
              <strong>Privado.</strong> La ubicación aparece solo con consentimiento.
            </span>
          </li>
          <li>
            <IconoCandado />
            <span>
              <strong>Seguro.</strong> La sesión viaja cifrada y protegida.
            </span>
          </li>
        </ul>
        <PildoraServicios />
      </section>

      <section className="tarjeta-acceso" aria-labelledby="titulo-login">
        <h1 id="titulo-login" className="tarjeta-acceso__titulo">
          Inicia sesión. <span className="tarjeta-acceso__complemento">Usa tu cuenta de administración o de análisis.</span>
        </h1>


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
            <div className="campo-formulario__con-boton">
            <input
              id="campo-password"
              name="password"
              type={verPassword ? 'text' : 'password'}
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
              onKeyUp={revisarMayusculas}
              onKeyDown={revisarMayusculas}
              aria-invalid={errorPassword ? true : undefined}
              aria-describedby={[errorPassword && 'error-password', mayusculas && 'aviso-mayusculas'].filter(Boolean).join(' ') || undefined}
              disabled={enviando}
              required
            />
            <button
              type="button"
              className="campo-formulario__ver"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
              disabled={enviando}
            >
              <IconoOjo tachado={verPassword} />
            </button>
            </div>
            {mayusculas && (
              <p id="aviso-mayusculas" className="campo-formulario__aviso">
                Bloq Mayús está activado.
              </p>
            )}
            {errorPassword && (
              <p id="error-password" className="campo-formulario__error">
                {errorPassword}
              </p>
            )}
          </div>

          {/* Error del servidor bajo los campos, con una sacudida breve */}
          {alerta && (
            <div
              key={sacudir}
              className={`alerta-acceso alerta-acceso--sacudir ${
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

          <button
            type="submit"
            className="boton boton--primario boton--ancho"
            disabled={enviando}
          >
            {enviando && <span className="indicador-carga indicador-carga--boton" aria-hidden="true" />}
            {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="tarjeta-acceso__nota">
          El panel es de solo lectura. La sesión dura 60 minutos.
        </p>
      </section>
    </main>
  );
}
