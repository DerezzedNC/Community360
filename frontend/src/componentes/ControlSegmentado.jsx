// Control segmentado (HIG): 2 a 5 segmentos del mismo ancho, solo texto,
// el seleccionado en --superficie sobre fondo --relleno.
export default function ControlSegmentado({ etiqueta, opciones, valor, alCambiar }) {
  return (
    <div className="segmentado" role="group" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          className={`segmentado__opcion ${valor === opcion.valor ? 'segmentado__opcion--activa' : ''}`}
          aria-pressed={valor === opcion.valor}
          onClick={() => alCambiar(opcion.valor)}
        >
          {opcion.texto}
        </button>
      ))}
    </div>
  );
}
