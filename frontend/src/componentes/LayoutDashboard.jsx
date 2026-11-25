import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { consultarSalud } from '../servicios/api';

export default function LayoutDashboard() {
  const [salud, setSalud] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

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

  const estadoSalud = salud?.estado;
  const claseEstadoSalud =
    estadoSalud === 'ok'
      ? 'estado-salud--ok'
      : estadoSalud === 'degradado'
        ? 'estado-salud--degradado'
        : 'estado-salud--desconectado';

  return (
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
          <p className="navegacion__etiqueta">Panel de consulta</p>
          <NavLink
            to="/dashboard"
            end
            onClick={() => setMenuAbierto(false)}
            className={({ isActive }) =>
              `navegacion__enlace ${isActive ? 'navegacion__enlace--activo' : ''}`
            }
          >
            Resumen general
          </NavLink>
        </nav>

        <div className="barra-lateral__pie">
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
          </div>
        </header>

        <main className="contenido-principal">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
