import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorGrafica, EsqueletoGrafica, TablaDatos } from './LienzoEcharts';
import { escaparHtml, useTemaGraficas } from './temaGraficas';

// Fondo atenuado: teselas de OpenStreetMap con filtro gris (en CSS, clase .teselas-atenuadas).
// Las teselas de CARTO Positron ahora piden una clave de API, así que se usa la alternativa de docs/DISENO.md §5.
const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores de OpenStreetMap</a>';

// Gama del azul para las manchas (de menos a más usuarios)
const GAMA_CLARO = ['#4DA2FF', '#2A8CF7', '#0F78EC', '#0067D6', '#0055B3'];
const GAMA_OSCURO = ['#1A7FEA', '#3399FF', '#5CADFF', '#85C2FF', '#B3DAFF'];

// Con zoom lejano un cuadro de 0.2° mide menos de 1 px: el borde, del mismo color, lo hace visible.
// No cambia su tamaño ni su posición; de cerca el borde vuelve a 1 px.
function grosorPorZoom(zoom) {
  if (zoom <= 4) return 6;
  if (zoom <= 5) return 4;
  if (zoom <= 6) return 2;
  return 1;
}

function colorDeCuadro(usuarios, minimo, maximo, gama) {
  const razon = maximo > minimo ? (usuarios - minimo) / (maximo - minimo) : 1;
  const indice = Math.min(gama.length - 1, Math.floor(razon * gama.length));
  return gama[indice];
}

// Mapa de calor geográfico en cuadrícula. Dibuja exclusivamente los cuadros entregados por la API,
// sin interpolación más fina.
export default function MapaPuntosCalientes({
  datos,
  tamanoCuadro = 0.2,
  altura = '400px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Mapa geográfico de puntos calientes',
  tabla = null,
}) {
  const tema = useTemaGraficas();
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const capaCuadrosRef = useRef(null);
  const capaTeselasRef = useRef(null);

  const sinDatos = !Array.isArray(datos) || datos.length === 0;
  const mostrarMapa = !cargando && !error && !sinDatos;
  const gama = tema.oscuro ? GAMA_OSCURO : GAMA_CLARO;

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
      capaTeselasRef.current = null;
    };
  }, [mostrarMapa]);

  // Fondo atenuado; el filtro cambia solo con el modo del sistema (CSS)
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mostrarMapa || !mapa) {
      return;
    }
    capaTeselasRef.current = L.tileLayer(TESELAS, {
      attribution: ATRIBUCION,
      maxZoom: 11,
      className: 'teselas-atenuadas',
    }).addTo(mapa);
    capaTeselasRef.current.bringToBack();
  }, [mostrarMapa]);

  useEffect(() => {
    if (!mostrarMapa || !mapaRef.current || !capaCuadrosRef.current) {
      return undefined;
    }

    const mapa = mapaRef.current;
    const capa = capaCuadrosRef.current;
    capa.clearLayers();

    const lado = Number(tamanoCuadro) > 0 ? Number(tamanoCuadro) : 0.2;
    const mitad = lado / 2;
    const contorno = tema.oscuro ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.9)';
    const seleccion = { weight: 3, color: tema.texto, fillColor: tema.color('indigo'), fillOpacity: 0.9 };
    let seleccionado = null;

    function estiloBase(usuarios) {
      const grosor = grosorPorZoom(mapa.getZoom() ?? 3);
      const relleno = colorDeCuadro(usuarios, rango.minimo, rango.maximo, gama);
      return {
        weight: grosor,
        color: grosor > 1 ? relleno : contorno,
        opacity: 0.9,
        fillColor: relleno,
        fillOpacity: 0.78,
      };
    }

    function quitarSeleccion() {
      if (seleccionado) {
        seleccionado.capa.setStyle(estiloBase(seleccionado.usuarios));
        seleccionado = null;
      }
    }

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

      const rectangulo = L.rectangle(
        [
          [sur, oeste],
          [norte, este],
        ],
        { ...estiloBase(usuarios), usuarios }
      );

      // Al seleccionar: contorno, cambio de color y un globo con el número de usuarios
      rectangulo.bindPopup(
        `<strong>${usuarios.toLocaleString('es-MX')} ${usuarios === 1 ? 'usuario' : 'usuarios'}</strong><br/>` +
          `Cuadro de ${escaparHtml(lado)}° con centro en ${lat.toFixed(1)}°, ${lon.toFixed(1)}°`,
        { closeButton: false, autoPanPadding: [24, 24], className: 'globo-mapa' }
      );
      rectangulo.on('click', () => {
        quitarSeleccion();
        rectangulo.setStyle(seleccion);
        rectangulo.bringToFront();
        seleccionado = { capa: rectangulo, usuarios };
      });
      rectangulo.on('popupclose', () => {
        if (seleccionado?.capa === rectangulo) quitarSeleccion();
      });

      rectangulo.addTo(capa);
    }

    const limites = capa.getBounds();
    if (limites.isValid()) {
      mapa.fitBounds(limites, { padding: [24, 24], maxZoom: 8 });
    }

    function ajustarGrosor() {
      capa.eachLayer((rect) => {
        if (seleccionado?.capa === rect) return;
        rect.setStyle(estiloBase(rect.options.usuarios));
      });
    }
    ajustarGrosor();
    mapa.on('zoomend', ajustarGrosor);
    return () => {
      mapa.off('zoomend', ajustarGrosor);
    };
  }, [datos, gama, mostrarMapa, rango.maximo, rango.minimo, tamanoCuadro, tema]);

  if (cargando) {
    return <EsqueletoGrafica forma="mapa" altura={altura} />;
  }

  if (error) {
    return <ErrorGrafica error={error} alReintentar={alReintentar} altura={altura} />;
  }

  if (sinDatos) {
    return (
      <div className="estado-grafica" style={{ minHeight: altura }} role="status">
        <p className="estado-grafica__texto">Todavía no hay cuadros con 3 usuarios o más.</p>
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
        aria-label={etiquetaAria}
      />
      <div className="pie-mapa">
        <div className="leyenda-mapa-puntos">
          <span>{rango.minimo.toLocaleString('es-MX')}</span>
          <span
            className="leyenda-mapa-puntos__barra"
            style={{ background: `linear-gradient(90deg, ${gama.join(', ')})` }}
            aria-hidden="true"
          />
          <span>{rango.maximo.toLocaleString('es-MX')} usuarios por cuadro</span>
        </div>
        <TablaDatos tabla={tabla} />
      </div>
    </div>
  );
}
