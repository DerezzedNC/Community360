import { useEffect, useState } from 'react';

// Preferencias del sistema que cambian la presentación (HIG: sin ajuste propio de la app).
const CONSULTAS = {
  oscuro: '(prefers-color-scheme: dark)',
  altoContraste: '(prefers-contrast: more)',
  reducirMovimiento: '(prefers-reduced-motion: reduce)',
};

function leer() {
  const resultado = {};
  for (const [clave, consulta] of Object.entries(CONSULTAS)) {
    resultado[clave] =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(consulta).matches
        : false;
  }
  return resultado;
}

export default function usePreferenciasSistema() {
  const [preferencias, setPreferencias] = useState(leer);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const listas = Object.values(CONSULTAS).map((consulta) => window.matchMedia(consulta));
    const alCambiar = () => setPreferencias(leer());
    listas.forEach((lista) => lista.addEventListener('change', alCambiar));
    return () => listas.forEach((lista) => lista.removeEventListener('change', alCambiar));
  }, []);

  return preferencias;
}
