import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ProveedorCatalogos } from '../contextos/ContextoCatalogos';
import { ProveedorEnVivo, estadoConexion, useEnVivo } from '../contextos/ContextoEnVivo';
import { ErrorApi, cerrarSesion, consultarSalud } from '../servicios/api';
import { formatearTiempoRelativo } from '../utilidades/formato';
import { IconoActualizar, IconoCambio, IconoPalomita } from './Iconos';

const SECCIONES = [
  { a: '/dashboard', texto: 'Métricas', fin: true },
  { a: '/dashboard/usuarios', texto: 'Usuarios' },
  { a: '/dashboard/cuarentena', texto: 'Cuarentena' },
];

const ETIQUETAS_CAMBIO = {
  creada: 'Interacción creada',
  editada: 'Interacción editada',
  borrada: 'Interacción borrada',
};
const SEGUNDOS_AVISO = 8;
const MAX_AVISOS = 3;

function useAhora(cadaMs) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(t);
  }, [cadaMs]);
  return ahora;
}

// Indicador de conexión y "Actualizar en vivo": el mismo en todas las vistas
function ControlesEnVivo({ salud }) {
  const { conexionWs, esperaReconexionSeg, solicitandoActualizacion, solicitarActualizacion, reconectarAhora } =
    useEnVivo();
  const estado = estadoConexion(conexionWs, esperaReconexionSeg);
  const [confirmado, setConfirmado] = useState(false);
  const esperabaRef = useRef(false);

  // Palomita breve al recibir la respuesta del pedido manual
  useEffect(() => {
    if (solicitandoActualizacion) {
      esperabaRef.current = true;
      return undefined;
    }
    if (!esperabaRef.current) return undefined;
    esperabaRef.current = false;
    setConfirmado(true);
    const t = window.setTimeout(() => setConfirmado(false), 1500);
    return () => window.clearTimeout(t);
  }, [solicitandoActualizacion]);

  const detalleServicio =
    salud?.estado === 'ok'
      ? 'Los datos de usuarios e interacciones responden'
      : salud?.estado === 'degradado'
        ? `Sin respuesta de ${[!salud.tidb && 'los datos de usuarios', !salud.capella && 'las interacciones'].filter(Boolean).join(' ni de ')}`
        : '';
  const detalleEspera = conexionWs === 'reconectando' && esperaReconexionSeg > 0 ? `Nuevo intento en ${esperaReconexionSeg} s` : '';

  return (
    <>
      <span
        className={`indicador indicador--${estado.clase}`}
        role="status"
        aria-live="polite"
        title={[detalleEspera, detalleServicio].filter(Boolean).join('. ') || undefined}
      >
        <span className="indicador__punto" aria-hidden="true" />
        {estado.texto}
      </span>
      {conexionWs === 'conectado' ? (
        <button
          type="button"
          className={`boton boton--primario boton--barra boton-actualizar ${solicitandoActualizacion ? 'boton-actualizar--esperando' : ''}`}
          onClick={solicitarActualizacion}
          disabled={solicitandoActualizacion}
        >
          {confirmado ? <IconoPalomita /> : <IconoActualizar />}
          {solicitandoActualizacion ? 'Actualizando…' : confirmado ? 'Actualizado' : 'Actualizar en vivo'}
        </button>
      ) : (
        <button type="button" className="boton boton--secundario boton--barra" onClick={reconectarAhora}>
          Reconectar ahora
        </button>
      )}
    </>
  );
}

// Avisos flotantes apilados (máximo 3) con los eventos del WebSocket; se pueden cerrar
function AvisosFlotantes() {
  const { eventos } = useEnVivo();
  const ahora = useAhora(1000);
  const [cerrados, setCerrados] = useState(() => new Set());

  const visibles = eventos
    .filter((e) => !cerrados.has(e.recibidoEnMs) && ahora - e.recibidoEnMs < SEGUNDOS_AVISO * 1000)
    .slice(0, MAX_AVISOS);

  return (
    <div className="avisos-flotantes" role="status" aria-live="polite">
      {visibles.map((evento) => (
        <div key={evento.recibidoEnMs} className={`aviso-flotante aviso-flotante--${evento.tipo}`}>
          <IconoCambio tipo={evento.tipo} />
          <span className="aviso-flotante__texto">
            {ETIQUETAS_CAMBIO[evento.tipo] || `Interacción ${evento.tipo}`} ·{' '}
            <span className="aviso-flotante__id">{evento.id_interaccion}</span> ·{' '}
            {formatearTiempoRelativo(evento.recibidoEnMs, ahora)}
          </span>
          <button
            type="button"
            className="aviso-flotante__cerrar"
            aria-label="Cerrar aviso"
            onClick={() => setCerrados((previos) => new Set(previos).add(evento.recibidoEnMs))}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function LayoutInterno() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const contexto = useOutletContext() || {};
  const usuario = contexto.usuario || null;

  const [salud, setSalud] = useState(undefined); // undefined: todavía sin respuesta
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorCierre, setErrorCierre] = useState('');

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
              <div className="barra__en-vivo">
                <ControlesEnVivo salud={salud} />
              </div>
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
        {/* Fundido de 200 ms al cambiar de vista */}
        <div key={ubicacion.pathname} className="vista-transicion">
          <Outlet context={{ usuario }} />
        </div>
      </main>

      <AvisosFlotantes />
    </div>
  );
}

export default function LayoutDashboard() {
  return (
    <ProveedorCatalogos>
      <ProveedorEnVivo>
        <LayoutInterno />
      </ProveedorEnVivo>
    </ProveedorCatalogos>
  );
}
