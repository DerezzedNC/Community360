export default function TarjetaSeccion({
  id,
  titulo,
  descripcion,
  rutaApi,
  insigniaPrivacidad = '',
  anchoCompleto = false,
  pendienteConexion = false,
  children,
}) {
  return (
    <article
      id={id}
      className={`tarjeta-seccion ${
        anchoCompleto ? 'tarjeta-seccion--completa' : ''
      }`}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="tarjeta-seccion__encabezado">
        <div>
          <div className="tarjeta-seccion__fila-titulo">
            <h2 id={`${id}-titulo`} className="tarjeta-seccion__titulo">
              {titulo}
            </h2>
            {insigniaPrivacidad && (
              <span className="insignia-privacidad">{insigniaPrivacidad}</span>
            )}
          </div>
          {descripcion && (
            <p className="tarjeta-seccion__descripcion">{descripcion}</p>
          )}
        </div>
        {rutaApi && (
          <code className="tarjeta-seccion__ruta" title="Endpoint del contrato">
            {rutaApi}
          </code>
        )}
      </header>

      <div className="tarjeta-seccion__cuerpo">
        {pendienteConexion ? (
          <div className="estado-pendiente" role="status">
            <span className="estado-pendiente__punto" aria-hidden="true" />
            <p className="estado-pendiente__texto">
              Pendiente de conexión con la API
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}
