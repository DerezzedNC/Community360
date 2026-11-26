import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../servicios/api';

export default function useConsultaApi(funcionConsulta) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({
    cargando: true,
    datos: null,
    error: '',
  });

  useEffect(() => {
    const controlador = new AbortController();
    setEstado((previo) => ({ ...previo, cargando: true, error: '' }));

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
        setEstado({
          cargando: false,
          datos: null,
          error: mensaje,
        });
      });

    return () => controlador.abort();
  }, [funcionConsulta, intento]);

  const reintentar = useCallback(() => {
    setIntento((previo) => previo + 1);
  }, []);

  return {
    cargando: estado.cargando,
    datos: estado.datos,
    error: estado.error,
    reintentar,
  };
}
