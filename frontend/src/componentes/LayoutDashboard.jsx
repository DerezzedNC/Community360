import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ProveedorCatalogos } from '../contextos/ContextoCatalogos';
import { ErrorApi, cerrarSesion, consultarSalud } from '../servicios/api';

const SECCIONES = [
  { a: '/dashboard', texto: 'Métricas', fin: true },
  { a: '/dashboard/usuarios', texto: 'Usuarios' },
  { a: '/dashboard/cuarentena', texto: 'Cuarentena' },
];

// Fuera de Métricas no hay WebSocket: la barra muestra el estado del servicio (GET /api/health)
function IndicadorServicio({ salud }) {
  if (salud === undefined) {
    return (
      <span className="indicador indicador--apagado" role="status">
        <span className="indicador__punto" aria-hidden="true" />
        Comprobando servicio
      </span>
    );
  }
  if (salud?.estado === 'ok') {
    return (
      <span className="indicador indicador--ok" role="status">
        <span className="indicador__punto" aria-hidden="true" />
        Servicio disponible
      </span>
    );
  }
  if (salud?.estado === 'degradado') {
    const faltan = [!salud.tidb && 'TiDB', !salud.capella && 'Capella'].filter(Boolean).join(' y ');
    return (
      <span className="indicador indicador--aviso" role="status">
        <span className="indicador__punto" aria-hidden="true" />
        {faltan ? `Sin conexión con ${faltan}` : 'Servicio incompleto'}
      </span>
    );
  }
  return (
    <span className="indicador indicador--apagado" role="status">
      <span className="indicador__punto" aria-hidden="true" />
      Sin conexión
    </span>
  );
}

export default function LayoutDashboard() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const contexto = useOutletContext() || {};
  const usuario = contexto.usuario || null;

  const [salud, setSalud] = useState(undefined); // undefined: todavía sin respuesta
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCierre, setErrorCierre] = useState('');
  // Lugar de la barra donde el dashboard pone el estado del WebSocket y "Actualizar en vivo"
  const [ranuraEnVivo, setRanuraEnVivo] = useState(null);

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

  // El menú móvil se cierra al cambiar de vista y con Esc
  useEffect(() => {
    setMenuAbierto(false);
  }, [ubicacion.pathname]);

  useEffect(() => {
    if (!menuAbierto) {
      return undefined;
    }
    function manejarTecla(evento) {
      if (evento.key === 'Escape') setMenuAbierto(false);
    }
    document.addEventListener('keydown', manejarTecla);
    return () => document.removeEventListener('keydown', manejarTecla);
  }, [menuAbierto]);

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
        'No se pudo cerrar la sesión porque el servidor no respondió. Revisa la conexión y elige Cerrar sesión otra vez.'
      );
      setCerrandoSesion(false);
    }
  }

  return (
    <ProveedorCatalogos>
      <div className="app">
        <a className="saltar-al-contenido" href="#contenido">
          Saltar al contenido
        </a>

        <header className={`barra ${menuAbierto ? 'barra--abierta' : ''}`}>
          <div className="barra__pildora">
            <NavLink to="/dashboard" end className="barra__marca">
              COMMUNITY 360
            </NavLink>

            <button
              type="button"
              className="barra__menu"
              aria-expanded={menuAbierto}
              aria-controls="barra-paneles"
              onClick={() => setMenuAbierto((previo) => !previo)}
            >
              {menuAbierto ? 'Cerrar menú' : 'Menú'}
            </button>

            <div id="barra-paneles" className="barra__paneles">
              <nav className="barra__nav" aria-label="Secciones">
                {SECCIONES.map((seccion) => (
                  <NavLink
                    key={seccion.a}
                    to={seccion.a}
                    end={seccion.fin}
                    className={({ isActive }) => `barra__enlace ${isActive ? 'barra__enlace--activo' : ''}`}
                  >
                    {seccion.texto}
                  </NavLink>
                ))}
              </nav>

              <div className="barra__derecha">
                <div ref={setRanuraEnVivo} className="barra__en-vivo" />
                {!enVistaMetricas && <IndicadorServicio salud={salud} />}
                {usuario && (
                  <span className="pildora-usuario">
                    {usuario.nombre}
                    <span className="pildora-usuario__rol">{usuario.rol}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="boton boton--secundario boton--barra"
                  onClick={manejarCierreSesion}
                  disabled={cerrandoSesion}
                >
                  {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {errorCierre && (
          <div className="aviso-cierre" role="alert">
            {errorCierre}
          </div>
        )}

        <main id="contenido" className="contenido" tabIndex={-1}>
          <Outlet context={{ usuario, ranuraEnVivo }} />
        </main>
      </div>
    </ProveedorCatalogos>
  );
}
