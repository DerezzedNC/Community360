import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../servicios/api';

export default function useConsultaApi(funcionConsulta) {
  const [solicitud, setSolicitud] = useState({ id: 0, silenciosa: false });
  const [estado, setEstado] = useState({
    cargando: true,
    datos: null,
    error: '',
  });

  useEffect(() => {
    const controlador = new AbortController();

    setEstado((previo) => ({
      ...previo,
      // Si ya hay datos en pantalla y es un refresco por evento en tiempo real,
      // no se desmonta la gráfica para actualizarla sin parpadeo.
      cargando: solicitud.silenciosa && previo.datos !== null ? false : true,
      error: solicitud.silenciosa && previo.datos !== null ? previo.error : '',
    }));

    funcionConsulta(controlador.signal)
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          setEstado({
            cargando: false,
            datos: respuesta,
            error: '',
          });
        }
      })
      .catch((err) => {
        if (controlador.signal.aborted) {
          return;
        }
        const mensaje =
          err instanceof ErrorApi && typeof err.datos?.detail === 'string'
            ? err.datos.detail
            : 'No se pudo obtener la información desde la API.';

        setEstado((previo) =>
          solicitud.silenciosa && previo.datos !== null
            ? previo
            : {
                cargando: false,
                datos: null,
                error: mensaje,
              }
        );
      });

    return () => controlador.abort();
  }, [funcionConsulta, solicitud]);

  const reintentar = useCallback(() => {
    setSolicitud((previo) => ({ id: previo.id + 1, silenciosa: false }));
  }, []);

  const refrescarSilencioso = useCallback(() => {
    setSolicitud((previo) => ({ id: previo.id + 1, silenciosa: true }));
  }, []);

  return {
    cargando: estado.cargando,
    datos: estado.datos,
    error: estado.error,
    reintentar,
    refrescarSilencioso,
  };
}
