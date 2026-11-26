// Paginación en píldora (§8.6): "1–50 de 1,068", anterior y siguiente
export default function PaginacionTabla({
  pagina,
  limite,
  total,
  alCambiarPagina,
  deshabilitado = false,
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const inicio = total === 0 ? 0 : (pagina - 1) * limite + 1;
  const fin = Math.min(total, pagina * limite);

  return (
    <nav className="paginacion" aria-label="Páginas de resultados">
      <div className="paginacion__pildora">
        <button
          type="button"
          className="paginacion__boton"
          onClick={() => alCambiarPagina(pagina - 1)}
          disabled={deshabilitado || pagina <= 1}
          aria-label="Página anterior"
        >
          <span aria-hidden="true">‹</span> Anterior
        </button>
        <p className="paginacion__resumen" aria-live="polite">
          {total === 0
            ? 'Sin resultados'
            : `${inicio.toLocaleString('es-MX')}–${fin.toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')}`}
          <span className="sr-only">, página {pagina} de {totalPaginas}</span>
        </p>
        <button
          type="button"
          className="paginacion__boton"
          onClick={() => alCambiarPagina(pagina + 1)}
          disabled={deshabilitado || pagina >= totalPaginas}
          aria-label="Página siguiente"
        >
          Siguiente <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
}
