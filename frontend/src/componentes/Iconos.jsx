// Íconos propios, trazos simples en SVG (sin logos ni íconos de terceros).
const BASE = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function IconoActualizar(props) {
  return (
    <svg {...BASE} className="icono icono--actualizar" {...props}>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

export function IconoPalomita(props) {
  return (
    <svg {...BASE} className="icono" {...props}>
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

export function IconoOjo({ tachado = false, ...props }) {
  return (
    <svg {...BASE} width={18} height={18} className="icono" {...props}>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
      {tachado && <path d="M2.5 13.5l11-11" />}
    </svg>
  );
}

export function IconoEnVivo(props) {
  return (
    <svg {...BASE} width={20} height={20} className="icono" {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M4.5 4.5a5 5 0 0 0 0 7M11.5 4.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function IconoCandado(props) {
  return (
    <svg {...BASE} width={20} height={20} className="icono" {...props}>
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function IconoEscudo(props) {
  return (
    <svg {...BASE} width={20} height={20} className="icono" {...props}>
      <path d="M8 1.8l5 2v4c0 3.2-2.2 5.4-5 6.4-2.8-1-5-3.2-5-6.4v-4l5-2z" />
      <path d="M8 5.5v3.5" />
    </svg>
  );
}

// Un ícono por tipo de cambio: más (creada), lápiz (editada), menos (borrada)
export function IconoCambio({ tipo, ...props }) {
  return (
    <svg {...BASE} className={`icono icono-cambio icono-cambio--${tipo}`} {...props}>
      <circle cx="8" cy="8" r="6.5" />
      {tipo === 'creada' && <path d="M8 5v6M5 8h6" />}
      {tipo === 'borrada' && <path d="M5 8h6" />}
      {tipo !== 'creada' && tipo !== 'borrada' && <path d="M5.5 10.5l.5-2 3.5-3.5 1.5 1.5L7.5 10l-2 .5z" />}
    </svg>
  );
}
