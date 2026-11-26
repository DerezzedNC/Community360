import { useCatalogos } from '../contextos/ContextoCatalogos';

export default function SelectorCatalogo({
  id,
  etiqueta,
  catalogo,
  valor,
  alCambiar,
  textoTodos = 'Todos',
  deshabilitado = false,
}) {
  const { obtenerOpcionesFiltro } = useCatalogos();
  const opciones = obtenerOpcionesFiltro(catalogo);

  return (
    <div className="control-filtro">
      <label htmlFor={id} className="control-filtro__etiqueta">
        {etiqueta}
      </label>
      <select
        id={id}
        className="control-filtro__selector"
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        disabled={deshabilitado}
      >
        <option value="">{textoTodos}</option>
        {opciones.map((opcion) => (
          <option key={opcion.codigo} value={opcion.codigo}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
