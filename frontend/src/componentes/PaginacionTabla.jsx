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
    <nav className="paginacion" aria-label="Paginación de resultados">
      <p className="paginacion__resumen">
        {total === 0
          ? '0 registros encontrados'
          : `Mostrando ${inicio}–${fin} de ${total} · Página ${pagina} de ${totalPaginas}`}
      </p>

      <div className="paginacion__controles">
        <button
          type="button"
          className="boton-paginacion"
          onClick={() => alCambiarPagina(1)}
          disabled={deshabilitado || pagina <= 1}
        >
          Primera
        </button>
        <button
          type="button"
          className="boton-paginacion"
          onClick={() => alCambiarPagina(pagina - 1)}
          disabled={deshabilitado || pagina <= 1}
        >
          Anterior
        </button>
        <button
          type="button"
          className="boton-paginacion"
          onClick={() => alCambiarPagina(pagina + 1)}
          disabled={deshabilitado || pagina >= totalPaginas}
        >
          Siguiente
        </button>
        <button
          type="button"
          className="boton-paginacion"
          onClick={() => alCambiarPagina(totalPaginas)}
          disabled={deshabilitado || pagina >= totalPaginas}
        >
          Última
        </button>
      </div>
    </nav>
  );
}
