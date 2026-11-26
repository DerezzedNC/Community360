import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { escaparHtml } from './LienzoEcharts';

function obtenerEstiloCuadro(usuarios, minimo, maximo) {
  const razon =
    maximo > minimo ? (usuarios - minimo) / (maximo - minimo) : 1;

  if (razon >= 0.75) {
    return { color: '#b91c1c', fillColor: '#dc2626', fillOpacity: 0.68 };
  }
  if (razon >= 0.45) {
    return { color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.62 };
  }
  if (razon >= 0.2) {
    return { color: '#0284c7', fillColor: '#0ea5e9', fillOpacity: 0.56 };
  }
  return { color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.46 };
}

// Mapa de calor geográfico en cuadrícula sobre OpenStreetMap (Leaflet).
// Dibuja exclusivamente los cuadros entregados por la API, sin interpolación más fina.
export default function MapaPuntosCalientes({
  datos,
  tamanoCuadro = 0.2,
  altura = '400px',
  cargando = false,
  error = '',
  alReintentar,
}) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capaCuadrosRef = useRef(null);

  const sinDatos = !Array.isArray(datos) || datos.length === 0;
  const mostrarMapa = !cargando && !error && !sinDatos;

  const rango = useMemo(() => {
    if (sinDatos) {
      return { minimo: 0, maximo: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const celda of datos) {
      const u = Number(celda.usuarios);
      if (!Number.isNaN(u)) {
        if (u < min) min = u;
        if (u > max) max = u;
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = min;
    return { minimo: min, maximo: max };
  }, [datos, sinDatos]);

  useEffect(() => {
    if (!mostrarMapa || !contenedorRef.current) {
      return undefined;
    }

    const nodo = contenedorRef.current;
    const mapa = L.map(nodo, {
      scrollWheelZoom: false,
      minZoom: 3,
      maxZoom: 11,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 11,
    }).addTo(mapa);

    const capaCuadros = L.featureGroup().addTo(mapa);
    mapaRef.current = mapa;
    capaCuadrosRef.current = capaCuadros;

    const observador = new ResizeObserver(() => {
      mapa.invalidateSize();
    });
    observador.observe(nodo);

    return () => {
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
      capaCuadrosRef.current = null;
    };
  }, [mostrarMapa]);

  useEffect(() => {
    if (!mostrarMapa || !mapaRef.current || !capaCuadrosRef.current) {
      return;
    }

    const mapa = mapaRef.current;
    const capa = capaCuadrosRef.current;
    capa.clearLayers();

    const lado = Number(tamanoCuadro) > 0 ? Number(tamanoCuadro) : 0.2;
    const mitad = lado / 2;

    for (const item of datos) {
      const lat = Number(item.latitud_centro);
      const lon = Number(item.longitud_centro);
      const usuarios = Number(item.usuarios);

      if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(usuarios)) {
        continue;
      }

      const sur = Number((lat - mitad).toFixed(4));
      const norte = Number((lat + mitad).toFixed(4));
      const oeste = Number((lon - mitad).toFixed(4));
      const este = Number((lon + mitad).toFixed(4));

      const estilo = obtenerEstiloCuadro(
        usuarios,
        rango.minimo,
        rango.maximo
      );

      const rectangulo = L.rectangle(
        [
          [sur, oeste],
          [norte, este],
        ],
        {
          color: estilo.color,
          weight: 1.5,
          fillColor: estilo.fillColor,
          fillOpacity: estilo.fillOpacity,
        }
      );

      const textoTooltip =
        `<strong>Cuadro de ${escaparHtml(lado)}°</strong><br/>` +
        `Centro: ${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br/>` +
        `Usuarios con consentimiento: <strong>${usuarios.toLocaleString('es-MX')}</strong>`;

      rectangulo.bindTooltip(textoTooltip, {
        sticky: true,
        direction: 'top',
      });

      rectangulo.addTo(capa);
    }

    const limites = capa.getBounds();
    if (limites.isValid()) {
      mapa.fitBounds(limites, { padding: [24, 24], maxZoom: 8 });
    }
  }, [datos, mostrarMapa, rango.maximo, rango.minimo, tamanoCuadro]);

  if (cargando) {
    return (
      <div
        className="estado-grafica"
        style={{ minHeight: altura }}
        role="status"
        aria-live="polite"
      >
        <span className="indicador-carga" aria-hidden="true" />
        <p className="estado-grafica__texto">
          Cargando cuadrícula geográfica…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="estado-grafica estado-grafica--error"
        style={{ minHeight: altura }}
        role="alert"
      >
        <p className="estado-grafica__titulo">
          No se pudo cargar el mapa de puntos calientes
        </p>
        <p className="estado-grafica__texto">{error}</p>
        {typeof alReintentar === 'function' && (
          <button
            type="button"
            className="boton-secundario"
            onClick={alReintentar}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (sinDatos) {
    return (
      <div
        className="estado-grafica"
        style={{ minHeight: altura }}
        role="status"
      >
        <p className="estado-grafica__texto">Sin datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="envoltorio-mapa-puntos">
      <div
        ref={contenedorRef}
        className="contenedor-leaflet"
        style={{ height: altura }}
        role="region"
        aria-label="Mapa geográfico de densidad en cuadrícula de 0.2 grados"
      />
      <div className="leyenda-mapa-puntos" aria-hidden="true">
        <span>
          Menor concentración ({rango.minimo.toLocaleString('es-MX')})
        </span>
        <span className="leyenda-mapa-puntos__barra" />
        <span>
          Mayor concentración ({rango.maximo.toLocaleString('es-MX')})
        </span>
      </div>
    </div>
  );
}
