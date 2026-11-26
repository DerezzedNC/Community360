import { useEffect, useRef } from 'react';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Hoja modal (HIG): una a la vez, botón "Cerrar", se cierra con Esc, el foco queda dentro
// mientras está abierta y regresa al botón que la abrió.
export default function HojaModal({ idTitulo, titulo, antetitulo = '', alCerrar, children }) {
  const hojaRef = useRef(null);
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;

  useEffect(() => {
    const anterior = document.activeElement;
    const hoja = hojaRef.current;
    hoja?.querySelector('[data-cerrar]')?.focus();

    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        alCerrarRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !hoja) {
        return;
      }
      const elementos = Array.from(hoja.querySelectorAll(ENFOCABLES));
      if (elementos.length === 0) {
        return;
      }
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', manejarTecla);
    document.body.classList.add('con-hoja-abierta');
    return () => {
      document.removeEventListener('keydown', manejarTecla);
      document.body.classList.remove('con-hoja-abierta');
      if (anterior && typeof anterior.focus === 'function') {
        anterior.focus();
      }
    };
  }, []);

  return (
    <div
      className="hoja-fondo"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div ref={hojaRef} className="hoja" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className="hoja__encabezado">
          <div>
            {antetitulo && <p className="hoja__antetitulo">{antetitulo}</p>}
            <h2 id={idTitulo} className="hoja__titulo">
              {titulo}
            </h2>
          </div>
          <button type="button" className="boton boton--secundario" data-cerrar onClick={alCerrar}>
            Cerrar
          </button>
        </header>
        <div className="hoja__cuerpo">{children}</div>
      </div>
    </div>
  );
}
