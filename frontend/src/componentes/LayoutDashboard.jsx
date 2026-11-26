import { useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { ProveedorCatalogos } from '../contextos/ContextoCatalogos';
import {
  ErrorApi,
  cerrarSesion,
  consultarSalud,
} from '../servicios/api';

export default function LayoutDashboard() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const contexto = useOutletContext() || {};
  const usuario = contexto.usuario || null;

  const [salud, setSalud] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCierre, setErrorCierre] = useState('');

  const enVistaMetricas = ubicacion.pathname === '/dashboard';

  useEffect(() => {
    const controlador = new AbortController();

    consultarSalud(controlador.signal)
      .then((datos) => {
        if (datos && (datos.estado === 'ok' || datos.estado === 'degradado')) {
          setSalud(datos);
        } else {
          setSalud(null);
        }
      })
      .catch(() => {
        setSalud(null);
      });

    return () => controlador.abort();
  }, []);

  async function manejarCierreSesion() {
    if (cerrandoSesion) {
      return;
    }

    setCerrandoSesion(true);
    setErrorCierre('');

    try {
      await cerrarSesion();
      navegar('/login', { replace: true });
    } catch (error) {
      if (error instanceof ErrorApi && error.codigoHttp === 401) {
        navegar('/login', { replace: true });
        return;
      }

      setErrorCierre(
        'No se pudo cerrar la sesión porque el servidor no respondió. Intenta nuevamente.'
      );
      setCerrandoSesion(false);
    }
  }

  const estadoSalud = salud?.estado;
  const claseEstadoSalud =
    estadoSalud === 'ok'
      ? 'estado-salud--ok'
      : estadoSalud === 'degradado'
        ? 'estado-salud--degradado'
        : 'estado-salud--desconectado';

  return (
    <ProveedorCatalogos>
      <div className="estructura-app">
        <aside
          className={`barra-lateral ${menuAbierto ? 'barra-lateral--abierta' : ''}`}
          aria-label="Navegación principal"
        >
          <div className="marca">
            <span className="marca__sigla" aria-hidden="true">
              C360
            </span>
            <div>
              <p className="marca__titulo">COMMUNITY 360</p>
              <p className="marca__subtitulo">Analítica híbrida en la nube</p>
            </div>
          </div>

          <nav className="navegacion">
            <p className="navegacion__etiqueta">Vistas históricas</p>
            <NavLink
              to="/dashboard"
              end
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) =>
                `navegacion__enlace ${isActive ? 'navegacion__enlace--activo' : ''}`
              }
            >
              Métricas y gráficas
            </NavLink>

            {enVistaMetricas && (
              <div className="navegacion__grupo-anclas">
                <a
                  href="#seccion-resumen"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Resumen de indicadores
                </a>
                <a
                  href="#seccion-estatus"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Usuarios por estatus
                </a>
                <a
                  href="#seccion-plataformas"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Plataformas
                </a>
                <a
                  href="#seccion-temas"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Temas
                </a>
                <a
                  href="#seccion-geografia"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Geografía
                </a>
                <a
                  href="#seccion-actividad"
                  className="navegacion__subenlace"
                  onClick={() => setMenuAbierto(false)}
                >
                  Actividad
                </a>
              </div>
            )}

            <NavLink
              to="/dashboard/usuarios"
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) =>
                `navegacion__enlace ${isActive ? 'navegacion__enlace--activo' : ''}`
              }
            >
              Padrón de usuarios
            </NavLink>

            <NavLink
              to="/dashboard/cuarentena"
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) =>
                `navegacion__enlace ${isActive ? 'navegacion__enlace--activo' : ''}`
              }
            >
              Cuarentena
            </NavLink>
          </nav>

          <div className="barra-lateral__pie">
            {usuario && (
              <div className="ficha-usuario">
                <p className="ficha-usuario__nombre">{usuario.nombre}</p>
                <p className="ficha-usuario__correo">{usuario.correo}</p>
                <span className="ficha-usuario__rol">{usuario.rol}</span>
              </div>
            )}
            <span className="etiqueta-lectura">Modo solo lectura</span>
          </div>
        </aside>

        {menuAbierto && (
          <button
            type="button"
            className="fondo-movil"
            aria-label="Cerrar menú lateral"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <div className="contenedor-principal">
          <header className="encabezado">
            <div className="encabezado__izquierda">
              <button
                type="button"
                className="boton-menu"
                onClick={() => setMenuAbierto((previo) => !previo)}
                aria-label="Alternar menú de navegación"
              >
                ☰
              </button>
              <div>
                <h1 className="encabezado__titulo">Panel Analítico</h1>
                <p className="encabezado__descripcion">
                  TiDB Cloud · Couchbase Capella
                </p>
              </div>
            </div>

            <div className="encabezado__derecha">
              <div
                className={`estado-salud ${claseEstadoSalud}`}
                role="status"
                aria-live="polite"
              >
                <span className="estado-salud__punto" aria-hidden="true" />
                {estadoSalud === 'ok' ? (
                  <span>
                    API activa · TiDB: {salud.tidb ? 'ok' : 'sin conexión'} · Capella:{' '}
                    {salud.capella ? 'ok' : 'sin conexión'}
                  </span>
                ) : estadoSalud === 'degradado' ? (
                  <span>
                    degradado · TiDB: {salud.tidb ? 'ok' : 'sin conexión'} · Capella:{' '}
                    {salud.capella ? 'ok' : 'sin conexión'}
                  </span>
                ) : (
                  <span>sin conexión</span>
                )}
              </div>

              {usuario && (
                <div className="sesion-encabezado">
                  <span className="sesion-encabezado__usuario">
                    {usuario.nombre}{' '}
                    <span className="sesion-encabezado__rol">({usuario.rol})</span>
                  </span>
                </div>
              )}

              <button
                type="button"
                className="boton-cerrar-sesion"
                onClick={manejarCierreSesion}
                disabled={cerrandoSesion}
              >
                {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </div>
          </header>

          {errorCierre && (
            <div className="aviso-cierre" role="alert">
              {errorCierre}
            </div>
          )}

          <main className="contenido-principal">
            <Outlet context={{ usuario }} />
          </main>
        </div>
      </div>
    </ProveedorCatalogos>
  );
}
