// Estado vacío con un dibujo simple propio y una acción (docs/DISENO.md §8.6)
export default function EstadoVacio({ titulo, texto, accion = null }) {
  return (
    <div className="estado-vacio" role="status">
      <svg className="estado-vacio__dibujo" viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
        <rect x="18" y="14" width="70" height="52" rx="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M30 32h34M30 44h22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="86" cy="56" r="14" fill="var(--superficie)" stroke="currentColor" strokeWidth="2.5" />
        <path d="M96 66l10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="estado-vacio__titulo">{titulo}</p>
      {texto && <p className="estado-vacio__texto">{texto}</p>}
      {accion}
    </div>
  );
}
