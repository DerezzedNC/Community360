import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ErrorApi, consultarCatalogos } from '../servicios/api';

const LLAVES_CATALOGOS = [
  'rango_edad',
  'especie',
  'interes',
  'plataforma',
  'tema',
  'etiqueta',
  'tipo_interaccion',
  'dispositivo',
];

const ContextoCatalogos = createContext(null);

function extraerTextoFila(nombreCatalogo, fila) {
  if (!fila || typeof fila !== 'object') {
    return '';
  }
  if (nombreCatalogo === 'rango_edad') {
    return typeof fila.descripcion === 'string' ? fila.descripcion : '';
  }
  return typeof fila.nombre === 'string' ? fila.nombre : '';
}

export function ProveedorCatalogos({ children }) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({
    cargando: true,
    datos: null,
    error: '',
  });

  useEffect(() => {
    const controlador = new AbortController();

    setEstado((previo) => ({
      ...previo,
      cargando: true,
      error: '',
    }));

    consultarCatalogos(controlador.signal)
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          setEstado({
            cargando: false,
            datos: respuesta || {},
            error: '',
          });
        }
      })
      .catch((err) => {
        if (controlador.signal.aborted) {
          return;
        }
        // 401 ya dispara redirección global a /login desde peticionApi
        const mensaje =
          err instanceof ErrorApi && typeof err.datos?.detail === 'string'
            ? err.datos.detail
            : 'No se pudieron cargar los catálogos.';

        setEstado({
          cargando: false,
          datos: null,
          error: mensaje,
        });
      });

    return () => controlador.abort();
  }, [intento]);

  const reintentarCatalogos = useCallback(() => {
    setIntento((previo) => previo + 1);
  }, []);

  // Índice completo (incluye activo: false) para mostrar nombres legibles
  const mapasPorCodigo = useMemo(() => {
    const resultado = {};
    if (!estado.datos) {
      return resultado;
    }

    for (const llave of LLAVES_CATALOGOS) {
      const filas = Array.isArray(estado.datos[llave]) ? estado.datos[llave] : [];
      const mapa = new Map();
      for (const fila of filas) {
        if (fila && typeof fila.codigo === 'string') {
          mapa.set(fila.codigo, {
            etiqueta: extraerTextoFila(llave, fila) || fila.codigo,
            activo: Boolean(fila.activo),
            admite_texto:
              llave === 'tipo_interaccion' ? Boolean(fila.admite_texto) : undefined,
          });
        }
      }
      resultado[llave] = mapa;
    }

    return resultado;
  }, [estado.datos]);

  // Listas de opciones para filtros: estrictamente activo === true
  const opcionesActivasPorCatalogo = useMemo(() => {
    const resultado = {};
    if (!estado.datos) {
      return resultado;
    }

    for (const llave of LLAVES_CATALOGOS) {
      const filas = Array.isArray(estado.datos[llave]) ? estado.datos[llave] : [];
      resultado[llave] = filas
        .filter((fila) => fila && fila.activo === true && typeof fila.codigo === 'string')
        .map((fila) => ({
          codigo: fila.codigo,
          etiqueta: extraerTextoFila(llave, fila) || fila.codigo,
        }));
    }

    return resultado;
  }, [estado.datos]);

  const obtenerNombreLegible = useCallback(
    (nombreCatalogo, codigo) => {
      if (!codigo) {
        return '';
      }
      const mapa = mapasPorCodigo[nombreCatalogo];
      if (!mapa || !mapa.has(codigo)) {
        return codigo;
      }
      return mapa.get(codigo).etiqueta;
    },
    [mapasPorCodigo]
  );

  const obtenerOpcionesFiltro = useCallback(
    (nombreCatalogo) => {
      if (!estado.datos) {
        return [];
      }
      return opcionesActivasPorCatalogo[nombreCatalogo] || [];
    },
    [estado.datos, opcionesActivasPorCatalogo]
  );

  // Posición del código en su catálogo (orden por código, incluye inactivos): fija el color
  // de cada categoría en todas las gráficas (docs/DISENO.md §8.4). -1 si no existe.
  const obtenerIndiceCodigo = useCallback(
    (nombreCatalogo, codigo) => {
      const mapa = mapasPorCodigo[nombreCatalogo];
      if (!mapa || !mapa.has(codigo)) {
        return -1;
      }
      return Array.from(mapa.keys()).indexOf(codigo);
    },
    [mapasPorCodigo]
  );

  const valorContexto = useMemo(
    () => ({
      catalogosCargados: Boolean(estado.datos),
      cargandoCatalogos: estado.cargando,
      errorCatalogos: estado.error,
      reintentarCatalogos,
      obtenerNombreLegible,
      obtenerOpcionesFiltro,
      obtenerIndiceCodigo,
    }),
    [
      obtenerIndiceCodigo,
      estado.cargando,
      estado.datos,
      estado.error,
      obtenerNombreLegible,
      obtenerOpcionesFiltro,
      reintentarCatalogos,
    ]
  );

  return (
    <ContextoCatalogos.Provider value={valorContexto}>
      {children}
    </ContextoCatalogos.Provider>
  );
}

export function useCatalogos() {
  const contexto = useContext(ContextoCatalogos);
  if (!contexto) {
    throw new Error('useCatalogos debe utilizarse dentro de ProveedorCatalogos');
  }
  return contexto;
}
