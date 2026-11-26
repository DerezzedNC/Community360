import { useMemo } from 'react';
import usePreferenciasSistema from '../../hooks/usePreferenciasSistema';

// Colores de sistema de las HIG (docs/DISENO.md §1): [claro, oscuro, alto contraste]
const COLORES = {
  azul: ['#0088FF', '#0091FF', '#1E6EF4'],
  verde: ['#34C759', '#30D158', '#008932'],
  naranja: ['#FF8D28', '#FF9230', '#C55300'],
  rojo: ['#FF383C', '#FF4245', '#E9152D'],
  morado: ['#CB30E0', '#DB34F2', '#B02FC2'],
  indigo: ['#6155F5', '#6D7CFF', '#564ADE'],
  cian: ['#00C0E8', '#3CD3FE', '#007EAE'],
  menta: ['#00C8B3', '#00DAC3', '#008575'],
  rosa: ['#FF2D55', '#FF375F', '#E7124D'],
  cafe: ['#AC7F5E', '#B78A66', '#956D51'],
  gris: ['#8E8E93', '#8E8E93', '#6E6E73'],
};

// Orden fijo para categorías: la posición en el catálogo decide el color en todo el dashboard.
// Verde, naranja y rojo van al final porque el estatus ya los usa con significado.
const ORDEN_CATEGORIAS = ['azul', 'indigo', 'cian', 'morado', 'menta', 'rosa', 'cafe', 'naranja', 'verde', 'rojo'];

function elegir(nombre, columna) {
  return COLORES[nombre][columna];
}

function aRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Mezcla lineal entre dos colores hex (t de 0 a 1)
export function interpolar(desde, hasta, t) {
  const a = aRgb(desde);
  const b = aRgb(hasta);
  const k = Math.max(0, Math.min(1, t));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

export function useTemaGraficas() {
  const { oscuro, altoContraste, reducirMovimiento } = usePreferenciasSistema();

  return useMemo(() => {
    // Rellenos: columna del modo. En alto contraste (solo modo claro) se usa la tercera columna.
    const columna = altoContraste && !oscuro ? 2 : oscuro ? 1 : 0;
    const color = (nombre) => elegir(nombre, columna);

    return {
      oscuro,
      reducirMovimiento,
      animacion: reducirMovimiento ? false : true,
      duracion: reducirMovimiento ? 0 : 320,
      superficie: oscuro ? '#1d1d1f' : '#ffffff',
      relleno: oscuro ? '#2a2a2d' : '#e8e8ed',
      texto: oscuro ? '#f5f5f7' : '#1d1d1f',
      texto2: oscuro ? '#86868b' : '#6e6e73',
      guia: oscuro ? 'rgba(255,255,255,0.08)' : '#e8e8ed',
      sombra: oscuro ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)',
      fuente:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
      color,
      categoria: (indice) =>
        indice < 0
          ? color('gris')
          : color(ORDEN_CATEGORIAS[indice % ORDEN_CATEGORIAS.length]),
      estatus: {
        activo: color('verde'),
        en_riesgo: color('naranja'),
        inactivo: color('gris'),
      },
      // Mapas de calor: una sola gama del azul (de #E5F1FF a #0071E3; en oscuro, del azul hundido al azul de sistema)
      gamaCalor: oscuro ? ['#12263d', '#0b4f9c', '#0091FF'] : ['#E5F1FF', '#7DB8FF', '#0071E3'],
      // §8.4: actividad en azul → cian; edad × interés en índigo → rosa (para distinguirlos)
      gamaActividad: oscuro ? ['#123a5c', '#0a7fd6', '#3CD3FE'] : ['#DCEBFF', '#3D9BFF', '#00A3C4'],
      gamaCruce: oscuro ? ['#2a2557', '#6D7CFF', '#FF375F'] : ['#ECEAFE', '#6155F5', '#E7124D'],
      // Sentimiento divergente: rojo (−1) → gris (0) → verde (+1)
      colorSentimiento: (valor) => {
        const v = Math.max(-1, Math.min(1, Number(valor) || 0));
        const neutro = oscuro ? '#636366' : '#aeaeb2';
        return v < 0 ? interpolar(neutro, color('rojo'), -v) : interpolar(neutro, color('verde'), v);
      },
    };
  }, [altoContraste, oscuro, reducirMovimiento]);
}

// Tooltip común (docs/DISENO.md §5): superficie, sin borde, radio 12, sombra de tarjeta, 13 px.
export function tooltipBase(tema) {
  return {
    confine: true,
    backgroundColor: tema.superficie,
    borderWidth: 0,
    padding: [10, 14],
    extraCssText: `border-radius:12px;box-shadow:2px 4px 12px ${tema.oscuro ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.16)'};`,
    textStyle: { color: tema.texto, fontSize: 13, fontFamily: tema.fuente },
  };
}

export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
