import { useCallback, useEffect, useRef, useState } from 'react';

const ESPERAS_RECONEXION_MS = [1500, 3000, 6000, 12000, 30000];

function construirUrlWsMetricas() {
  const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocolo}//${window.location.host}/ws/metricas`;
}

function extraerCambioValido(cambio, ts) {
  if (
    cambio &&
    typeof cambio === 'object' &&
    typeof cambio.tipo === 'string' &&
    typeof cambio.id_interaccion === 'string'
  ) {
    return {
      tipo: cambio.tipo,
      id_interaccion: cambio.id_interaccion,
      recibidoEnMs: Date.now(),
      ts: typeof ts === 'string' ? ts : '',
    };
  }
  return null;
}

// Cliente WebSocket bidireccional para /ws/metricas según Contrato v0.13+.
// Sin sondeo HTTP propio: recibe al conectar, tras cada alta/cambio/baja y bajo pedido manual.
export default function useMetricasTiempoReal(alRecibirCambioPosterior) {
  const callbackCambioRef = useRef(alRecibirCambioPosterior);
  callbackCambioRef.current = alRecibirCambioPosterior;

  const socketRef = useRef(null);
  const [reinicioManual, setReinicioManual] = useState(0);
  const [solicitandoActualizacion, setSolicitandoActualizacion] = useState(false);
  const [ultimoCambio, setUltimoCambio] = useState(null);
  const [estadoWs, setEstadoWs] = useState({
    conexion: 'conectando', // 'conectando' | 'conectado' | 'reconectando' | 'origen_rechazado'
    resumen: null,
    ultimoEventoTs: '',
    avisoServicio: '',
    esperaSegundos: 0,
  });

  useEffect(() => {
    let cancelado = false;
    let temporizadorReconexion = null;
    let intentoFallido = 0;
    let yaRecibioResumenInicial = false;

    function limpiarTemporizador() {
      if (temporizadorReconexion !== null) {
        window.clearTimeout(temporizadorReconexion);
        temporizadorReconexion = null;
      }
    }

    function conectar() {
      if (cancelado) {
        return;
      }

      limpiarTemporizador();
      setSolicitandoActualizacion(false);
      setEstadoWs((previo) => ({
        ...previo,
        conexion: intentoFallido > 0 ? 'reconectando' : 'conectando',
        esperaSegundos: 0,
      }));

      let ws;
      try {
        ws = new WebSocket(construirUrlWsMetricas());
      } catch {
        programarReconexion();
        return;
      }

      socketRef.current = ws;

      ws.onmessage = (evento) => {
        if (cancelado) {
          return;
        }

        let mensaje;
        try {
          mensaje = JSON.parse(evento.data);
        } catch {
          return;
        }

        if (!mensaje || typeof mensaje !== 'object') {
          return;
        }

        intentoFallido = 0;
        setSolicitandoActualizacion(false);

        const nuevoCambio = extraerCambioValido(mensaje.cambio, mensaje.ts);
        if (nuevoCambio) {
          setUltimoCambio(nuevoCambio);
        }

        if (mensaje.evento === 'metricas.actualizadas' && mensaje.datos) {
          const esPosterior = yaRecibioResumenInicial;
          yaRecibioResumenInicial = true;

          setEstadoWs({
            conexion: 'conectado',
            resumen: mensaje.datos,
            ultimoEventoTs: typeof mensaje.ts === 'string' ? mensaje.ts : '',
            avisoServicio: '',
            esperaSegundos: 0,
          });

          if (esPosterior && typeof callbackCambioRef.current === 'function') {
            callbackCambioRef.current();
          }
        } else if (mensaje.evento === 'metricas.no_disponibles') {
          const detalle =
            typeof mensaje.datos?.detail === 'string'
              ? mensaje.datos.detail
              : 'Base de datos no disponible';

          setEstadoWs((previo) => ({
            ...previo,
            conexion: 'conectado',
            avisoServicio: detalle,
            esperaSegundos: 0,
          }));
        }
      };

      ws.onclose = (evento) => {
        if (cancelado) {
          return;
        }
        if (socketRef.current === ws) {
          socketRef.current = null;
        }
        setSolicitandoActualizacion(false);

        if (evento.code === 4401) {
          window.dispatchEvent(new CustomEvent('c360:sesion-expirada'));
          return;
        }

        if (evento.code === 4403) {
          setEstadoWs((previo) => ({
            ...previo,
            conexion: 'origen_rechazado',
            avisoServicio:
              'El servidor rechazó el origen del canal WebSocket (código 4403).',
            esperaSegundos: 0,
          }));
          return;
        }

        programarReconexion();
      };
    }

    function programarReconexion() {
      if (cancelado) {
        return;
      }

      const indice = Math.min(
        intentoFallido,
        ESPERAS_RECONEXION_MS.length - 1
      );
      const demoraMs = ESPERAS_RECONEXION_MS[indice];
      intentoFallido += 1;

      setEstadoWs((previo) => ({
        ...previo,
        conexion: 'reconectando',
        esperaSegundos: Math.round(demoraMs / 1000),
      }));

      limpiarTemporizador();
      temporizadorReconexion = window.setTimeout(() => {
        temporizadorReconexion = null;
        conectar();
      }, demoraMs);
    }

    function manejarVueltaDeRed() {
      if (!cancelado && socketRef.current === null) {
        intentoFallido = 0;
        conectar();
      }
    }

    window.addEventListener('online', manejarVueltaDeRed);
    conectar();

    return () => {
      cancelado = true;
      window.removeEventListener('online', manejarVueltaDeRed);
      limpiarTemporizador();
      if (socketRef.current) {
        socketRef.current.close(1000);
        socketRef.current = null;
      }
    };
  }, [reinicioManual]);

  const reconectarAhora = useCallback(() => {
    setReinicioManual((previo) => previo + 1);
  }, []);

  // Envía exactamente {"accion": "actualizar"} bajo acción manual del usuario
  const solicitarActualizacion = useCallback(() => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      setSolicitandoActualizacion(true);
      ws.send(JSON.stringify({ accion: 'actualizar' }));
    }
  }, []);

  return {
    conexionWs: estadoWs.conexion,
    resumen: estadoWs.resumen,
    ultimoEventoTs: estadoWs.ultimoEventoTs,
    avisoServicioResumen: estadoWs.avisoServicio,
    esperaReconexionSeg: estadoWs.esperaSegundos,
    ultimoCambio,
    solicitandoActualizacion,
    solicitarActualizacion,
    reconectarAhora,
  };
}
