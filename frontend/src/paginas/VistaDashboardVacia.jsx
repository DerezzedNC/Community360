export default function VistaDashboardVacia() {
  return (
    <section className="panel-vacio" aria-labelledby="titulo-panel-vacio">
      <div className="panel-vacio__tarjeta">
        <span className="panel-vacio__insignia">Estructura lista</span>
        <h2 id="titulo-panel-vacio" className="panel-vacio__titulo">
          Espacio preparado para métricas históricas y tiempo real
        </h2>
        <p className="panel-vacio__texto">
          Este panel es exclusivamente de consulta y mostrará únicamente datos
          reales obtenidos desde la API REST y el canal WebSocket.
        </p>
      </div>
    </section>
  );
}
