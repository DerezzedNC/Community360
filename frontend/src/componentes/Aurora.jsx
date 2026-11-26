// Fondo "aurora" (docs/DISENO.md §8.1): manchas difusas que se mueven muy lento, una retícula
// de puntos tenue y grano fino. Es solo decoración: no lleva datos ni números.
export default function Aurora({ tenue = false }) {
  return (
    <div className={`aurora ${tenue ? 'aurora--tenue' : ''}`} aria-hidden="true">
      <span className="aurora__mancha aurora__mancha--azul" />
      <span className="aurora__mancha aurora__mancha--indigo" />
      <span className="aurora__mancha aurora__mancha--cian" />
      <span className="aurora__mancha aurora__mancha--rosa" />
      <span className="aurora__reticula" />
      <span className="aurora__grano" />
    </div>
  );
}
