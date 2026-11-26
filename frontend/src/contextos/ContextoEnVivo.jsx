import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useMetricasTiempoReal from '../hooks/useMetricasTiempoReal';

// Canal en vivo compartido por todas las vistas (docs/DISENO.md §8.2).
// El hook del WebSocket no cambia: solo se monta en el layout para que el indicador, la
// actividad reciente y los avisos sean los mismos en Métricas, Usuarios y Cuarentena.
// Todo lo que se guarda aquí son eventos reales de esta sesión, en memoria.

const MAX_EVENTOS = 10;
const MAX_PUNTOS_SERIE = 60;
const CAMPOS_DELTA = ['interacciones', 'usuarios_que_interactuan', 'en_cuarentena', 'usuarios'];

const ContextoEnVivo = createContext(null);

export function ProveedorEnVivo({ children }) {
  // Las vistas registran qué refrescar cuando llega un cambio
  const oyentesRef = useRef(new Set());
  const avisarOyentes = useCallback(() => {
    oyentesRef.current.forEach((oyente) => oyente());
  }, []);

  const tiempoReal = useMetricasTiempoReal(avisarOyentes);
  const { resumen, ultimoCambio } = tiempoReal;

  const [eventos, setEventos] = useState([]);
  const [serie, setSerie] = useState([]);
  const [delta, setDelta] = useState(null);
  const resumenAnteriorRef = useRef(null);

  // Historial: cada cambio recibido (creada, editada, borrada) con su momento de llegada
  useEffect(() => {
    if (!ultimoCambio) return;
    setEventos((previos) => [ultimoCambio, ...previos].slice(0, MAX_EVENTOS));
  }, [ultimoCambio]);

  // Serie de la sesión y diferencias contra el resumen anterior
  useEffect(() => {
    if (!resumen) return;
    const ahora = Date.now();
    setSerie((previa) =>
      [...previa, { ms: ahora, interacciones: Number(resumen.interacciones) }].slice(-MAX_PUNTOS_SERIE)
    );
    const anterior = resumenAnteriorRef.current;
    if (anterior) {
      const cambios = {};
      for (const campo of CAMPOS_DELTA) {
        const diferencia = Number(resumen[campo]) - Number(anterior[campo]);
        if (Number.isFinite(diferencia) && diferencia !== 0) cambios[campo] = diferencia;
      }
      if (Object.keys(cambios).length > 0) setDelta({ ...cambios, recibidoEnMs: ahora });
    }
    resumenAnteriorRef.current = resumen;
  }, [resumen]);

  const alCambiar = useCallback((oyente) => {
    oyentesRef.current.add(oyente);
    return () => oyentesRef.current.delete(oyente);
  }, []);

  const valor = useMemo(
    () => ({ ...tiempoReal, eventos, serie, delta, alCambiar }),
    [tiempoReal, eventos, serie, delta, alCambiar]
  );

  return <ContextoEnVivo.Provider value={valor}>{children}</ContextoEnVivo.Provider>;
}

export function useEnVivo() {
  const contexto = useContext(ContextoEnVivo);
  if (!contexto) {
    throw new Error('useEnVivo debe utilizarse dentro de ProveedorEnVivo');
  }
  return contexto;
}

// Registra una función que se llama con cada metricas.actualizadas posterior al primero
export function useAlCambiarEnVivo(funcion) {
  const { alCambiar } = useEnVivo();
  const funcionRef = useRef(funcion);
  funcionRef.current = funcion;
  useEffect(() => alCambiar(() => funcionRef.current()), [alCambiar]);
}

// Texto único del indicador en todas las vistas (§8.2 y §8.7)
export function estadoConexion(conexionWs, esperaReconexionSeg) {
  if (conexionWs === 'conectado') return { clase: 'ok', texto: 'En vivo' };
  if (conexionWs === 'origen_rechazado') return { clase: 'error', texto: 'Sin conexión' };
  if (conexionWs === 'reconectando' && esperaReconexionSeg > 0) return { clase: 'apagado', texto: 'Sin conexión' };
  return { clase: 'apagado', texto: 'Reconectando…' };
}
