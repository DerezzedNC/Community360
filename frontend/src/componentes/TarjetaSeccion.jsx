import { useEffect, useRef, useState } from 'react';

// Entrada progresiva (§8.3): la tarjeta aparece al entrar en pantalla
export function useRevelar() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || visible) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible]);
  return [ref, visible];
}

// Tarjeta del dashboard (docs/DISENO.md §3, §6 y §8): título, subtítulo con unidades,
// frase-resumen calculada con los datos de la API, insignias de privacidad y el contenido.
export default function TarjetaSeccion({
  id,
  titulo,
  subtitulo = '',
  descripcion = '', // nombre anterior de subtitulo
  resumen = '',
  esperandoResumen = false,
  insignias = [],
  insigniaPrivacidad = '', // nombre anterior de insignias
  fuente = '',
  rutaApi = '', // nombre anterior de fuente
  ancho = 'mitad', // 'completo' | 'ancho' | 'mitad' | 'angosto' | 'tercio'
  anchoCompleto = false,
  nivelTitulo = 3,
  orden = 0, // posición en su fila: escalona la entrada 60 ms
  accion = null, // control opcional a la derecha del título
  children,
}) {
  const Titulo = `h${nivelTitulo}`;
  const [ref, visible] = useRevelar();
  const listaInsignias = insignias.length > 0 ? insignias : insigniaPrivacidad ? [insigniaPrivacidad] : [];
  const textoSubtitulo = subtitulo || descripcion;
  const textoFuente = fuente || rutaApi;
  const claseAncho = anchoCompleto ? 'completo' : ancho;

  return (
    <article
      ref={ref}
      id={id}
      className={`tarjeta tarjeta--${claseAncho} revelar ${visible ? 'revelar--visible' : ''}`}
      style={{ '--retraso': `${(orden % 4) * 60}ms` }}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="tarjeta__encabezado">
        <div className="tarjeta__fila-titulo">
          <Titulo id={`${id}-titulo`} className="tarjeta__titulo">
            {titulo}
          </Titulo>
          {accion}
        </div>
        {textoSubtitulo && <p className="tarjeta__subtitulo">{textoSubtitulo}</p>}
        {listaInsignias.length > 0 && (
          <ul className="insignias" aria-label="Privacidad">
            {listaInsignias.map((texto) => (
              <li key={texto} className="insignia">
                {texto}
              </li>
            ))}
          </ul>
        )}
        {resumen ? (
          <p className="tarjeta__resumen" aria-live="polite">
            {resumen}
          </p>
        ) : esperandoResumen ? (
          <span className="esqueleto-linea" aria-hidden="true" />
        ) : null}
      </header>

      <div className="tarjeta__cuerpo">{children}</div>

      {textoFuente && <code className="tarjeta__fuente">{textoFuente}</code>}
    </article>
  );
}
