import TarjetaSeccion from '../componentes/TarjetaSeccion';

export default function VistaCuarentena() {
  return (
    <div className="vista-historica">
      <TarjetaSeccion
        id="seccion-cuarentena"
        titulo="Cuarentena"
        descripcion="Consulta de solo lectura de registros rechazados durante las reglas de validación, con filtro por motivo en cuanto esté disponible el endpoint."
        rutaApi="GET /api/cuarentena"
        anchoCompleto
        pendienteConexion
      />
    </div>
  );
}
