// Tarjeta del dashboard (docs/DISENO.md §3 y §6): título, subtítulo con unidades,
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
  ancho = 'mitad', // 'completo' | 'ancho' | 'mitad' | 'angosto'
  anchoCompleto = false,
  nivelTitulo = 3,
  children,
}) {
  const Titulo = `h${nivelTitulo}`;
  const listaInsignias = insignias.length > 0 ? insignias : insigniaPrivacidad ? [insigniaPrivacidad] : [];
  const textoSubtitulo = subtitulo || descripcion;
  const textoFuente = fuente || rutaApi;
  const claseAncho = anchoCompleto ? 'completo' : ancho;

  return (
    <article
      id={id}
      className={`tarjeta tarjeta--${claseAncho}`}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="tarjeta__encabezado">
        <Titulo id={`${id}-titulo`} className="tarjeta__titulo">
          {titulo}
        </Titulo>
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

      {textoFuente && <p className="tarjeta__fuente">Fuente: {textoFuente}</p>}
    </article>
  );
}
