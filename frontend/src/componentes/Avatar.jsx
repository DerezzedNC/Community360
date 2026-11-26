import { useTemaGraficas } from './graficas/temaGraficas';

// Círculo con las iniciales del alias; el color se deriva del texto del alias (§8.6)
function hashTexto(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

function iniciales(alias) {
  const partes = String(alias || '?')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] || '?').slice(0, 2);
  return letras.toUpperCase();
}

export default function Avatar({ alias }) {
  const tema = useTemaGraficas();
  const color = tema.categoria(hashTexto(String(alias || '')) % 10);
  return (
    <span
      className="avatar"
      style={{ '--avatar-color': color, background: `${color}${tema.oscuro ? '40' : '2e'}` }}
      aria-hidden="true"
    >
      {iniciales(alias)}
    </span>
  );
}
