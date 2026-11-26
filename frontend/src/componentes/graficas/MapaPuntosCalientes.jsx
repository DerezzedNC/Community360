import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import usePreferenciasSistema from '../../hooks/usePreferenciasSistema';
import { ErrorGrafica, EsqueletoGrafica, TablaDatos } from './LienzoEcharts';
import { escaparHtml, useTemaGraficas } from './temaGraficas';

// Fondo atenuado: teselas de OpenStreetMap con filtro gris (clase .teselas-atenuadas).
// CARTO Positron y Dark Matter piden ahora una clave de API; se usa la alternativa de docs/DISENO.md §5.
const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores de OpenStreetMap</a>';

// Tope de zoom (sin cambios): de 3 a 11, y el encuadre automático hasta 8
const ZOOM_MIN = 3;
const ZOOM_MAX = 11;
const ZOOM_ENCUADRE = 8;
// Desde este zoom se ve el cuadro exacto de 0.2°; antes, una burbuja en su centro (§8.5)
const ZOOM_CUADROS = 7;
const ZOOM_AL_ELEGIR = 9;
// El encuadre inicial cubre los cuadros que reúnen este porcentaje de usuarios (la zona principal)
const PORCENTAJE_ENCUADRE = 0.6;
const TOP_RANKING = 5;

const GAMA_CLARO = ['#4DA2FF', '#2A8CF7', '#0F78EC', '#0067D6', '#0055B3'];
const GAMA_OSCURO = ['#1A7FEA', '#3399FF', '#5CADFF', '#85C2FF', '#B3DAFF'];

function razonDe(usuarios, minimo, maximo) {
  return maximo > minimo ? (usuarios - minimo) / (maximo - minimo) : 1;
}

function colorDeCuadro(razon, gama) {
  return gama[Math.min(gama.length - 1, Math.floor(razon * gama.length))];
}

function textoGlobo(usuarios, lado) {
  return `<strong>${usuarios.toLocaleString('es-MX')} ${usuarios === 1 ? 'usuario' : 'usuarios'}</strong> · cuadro de ${escaparHtml(lado)}°`;
}

// Mapa de calor geográfico en cuadrícula. Dibuja exclusivamente los cuadros entregados por la API,
// sin interpolación más fina ni puntos individuales.
export default function MapaPuntosCalientes({
  datos,
  tamanoCuadro = 0.2,
  altura = '400px',
  cargando = false,
  error = '',
  alReintentar,
  etiquetaAria = 'Mapa geográfico de puntos calientes',
  tabla = null,
  fuente = '',
}) {
  const tema = useTemaGraficas();
  const { reducirMovimiento } = usePreferenciasSistema();
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const accionesRef = useRef({ seleccionar: () => {}, verTodo: () => {} });
  const [elegido, setElegido] = useState(null);

  const sinDatos = !Array.isArray(datos) || datos.length === 0;
  const mostrarMapa = !cargando && !error && !sinDatos;
  const gama = tema.oscuro ? GAMA_OSCURO : GAMA_CLARO;
  const lado = Number(tamanoCuadro) > 0 ? Number(tamanoCuadro) : 0.2;

  // Cuadros válidos, de más a menos usuarios
  const cuadros = useMemo(() => {
    if (sinDatos) return [];
    return datos
      .map((item) => ({
        lat: Number(item.latitud_centro),
        lon: Number(item.longitud_centro),
        usuarios: Number(item.usuarios),
      }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && Number.isFinite(c.usuarios))
      .sort((a, b) => b.usuarios - a.usuarios || a.lat - b.lat || a.lon - b.lon);
  }, [datos, sinDatos]);

  const rango = useMemo(() => {
    if (cuadros.length === 0) return { minimo: 0, maximo: 0 };
    return { minimo: cuadros[cuadros.length - 1].usuarios, maximo: cuadros[0].usuarios };
  }, [cuadros]);

  // Crear el mapa (una vez por aparición)
  useEffect(() => {
    if (!mostrarMapa || !contenedorRef.current) {
      return undefined;
    }
    const nodo = contenedorRef.current;
    const mapa = L.map(nodo, {
      scrollWheelZoom: false,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      zoomAnimation: !reducirMovimiento,
      fadeAnimation: !reducirMovimiento,
    });
    L.tileLayer(TESELAS, { attribution: ATRIBUCION, maxZoom: ZOOM_MAX, className: 'teselas-atenuadas' }).addTo(mapa);
    mapaRef.current = mapa;

    const observador = new ResizeObserver(() => mapa.invalidateSize());
    observador.observe(nodo);
    return () => {
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
  }, [mostrarMapa, reducirMovimiento]);

  // Cuadros y burbujas
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mostrarMapa || !mapa || cuadros.length === 0) {
      return undefined;
    }
    const mitad = lado / 2;
    const contorno = tema.oscuro ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)';
    const capaCuadros = L.featureGroup();
    const capaBurbujas = L.featureGroup();
    let globo = null;

    const registros = cuadros.map((c, indice) => {
      const razon = razonDe(c.usuarios, rango.minimo, rango.maximo);
      const relleno = colorDeCuadro(razon, gama);
      const base = {
        cuadro: { weight: 1, color: contorno, opacity: 1, fillColor: relleno, fillOpacity: 0.78 },
        // Tamaño y brillo proporcionales a los usuarios del cuadro
        burbuja: {
          radius: 5 + 17 * Math.sqrt(razon),
          weight: 1.5,
          color: relleno,
          opacity: 0.9,
          fillColor: relleno,
          fillOpacity: 0.35 + 0.5 * razon,
        },
      };
      const rect = L.rectangle(
        [
          [Number((c.lat - mitad).toFixed(4)), Number((c.lon - mitad).toFixed(4))],
          [Number((c.lat + mitad).toFixed(4)), Number((c.lon + mitad).toFixed(4))],
        ],
        base.cuadro
      ).addTo(capaCuadros);
      const burbuja = L.circleMarker([c.lat, c.lon], { ...base.burbuja, className: 'burbuja-calor' }).addTo(capaBurbujas);
      return { ...c, indice, rect, burbuja, base };
    });

    function restablecer() {
      registros.forEach((r) => {
        r.rect.setStyle(r.base.cuadro);
        r.burbuja.setStyle(r.base.burbuja);
      });
      setElegido(null);
    }

    // Al seleccionar: contorno, globo con los usuarios y el resto atenuado
    function seleccionar(registro) {
      registros.forEach((r) => {
        if (r === registro) return;
        r.rect.setStyle({ opacity: 0.25, fillOpacity: 0.18 });
        r.burbuja.setStyle({ opacity: 0.25, fillOpacity: 0.12 });
      });
      registro.rect.setStyle({ weight: 3, color: tema.texto, opacity: 1, fillOpacity: 0.9 });
      registro.burbuja.setStyle({ weight: 3, color: tema.texto, opacity: 1, fillOpacity: 0.9 });
      registro.rect.bringToFront();
      registro.burbuja.bringToFront();
      if (globo) globo.off('remove', restablecer);
      globo = L.popup({ closeButton: false, autoPanPadding: [24, 24], className: 'globo-mapa', offset: [0, -6] })
        .setLatLng([registro.lat, registro.lon])
        .setContent(textoGlobo(registro.usuarios, lado));
      globo.on('remove', restablecer);
      globo.openOn(mapa);
      setElegido(registro.indice);
    }

    registros.forEach((registro) => {
      registro.rect.on('click', () => seleccionar(registro));
      registro.burbuja.on('click', () => seleccionar(registro));
    });

    function mostrarSegunZoom() {
      if (mapa.getZoom() >= ZOOM_CUADROS) {
        capaBurbujas.remove();
        capaCuadros.addTo(mapa);
      } else {
        capaCuadros.remove();
        capaBurbujas.addTo(mapa);
      }
    }

    function limitesDe(lista) {
      return L.latLngBounds(lista.flatMap((r) => [r.rect.getBounds().getSouthWest(), r.rect.getBounds().getNorthEast()]));
    }

    // Encuadre a los datos: los cuadros que reúnen el 60 % de los usuarios (no el mundo entero)
    const total = registros.reduce((s, r) => s + r.usuarios, 0);
    const principales = [];
    let acumulado = 0;
    for (const r of registros) {
      principales.push(r);
      acumulado += r.usuarios;
      if (acumulado >= total * PORCENTAJE_ENCUADRE) break;
    }

    mapa.on('zoomend', mostrarSegunZoom);
    mapa.fitBounds(limitesDe(principales), { padding: [28, 28], maxZoom: ZOOM_ENCUADRE, animate: false });
    mostrarSegunZoom();

    accionesRef.current = {
      seleccionar: (indice) => {
        const registro = registros[indice];
        if (!registro) return;
        mapa.setView([registro.lat, registro.lon], ZOOM_AL_ELEGIR, { animate: !reducirMovimiento });
        seleccionar(registro);
      },
      verTodo: () => {
        mapa.closePopup();
        mapa.fitBounds(limitesDe(registros), { padding: [28, 28], maxZoom: ZOOM_ENCUADRE, animate: !reducirMovimiento });
      },
    };

    return () => {
      mapa.off('zoomend', mostrarSegunZoom);
      if (globo) globo.off('remove', restablecer);
      mapa.closePopup();
      capaCuadros.remove();
      capaBurbujas.remove();
    };
  }, [cuadros, gama, lado, mostrarMapa, rango.maximo, rango.minimo, reducirMovimiento, tema]);

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
      <div className="mapa-y-ranking">
        <div className="mapa-marco">
          <div
            ref={contenedorRef}
            className="contenedor-leaflet"
            style={{ height: altura }}
            role="region"
            aria-label={etiquetaAria}
          />
          <button
            type="button"
            className="boton boton--secundario boton--chico mapa-ver-todo"
            onClick={() => accionesRef.current.verTodo()}
          >
            Ver todo
          </button>
        </div>

        <div className="ranking-zonas">
          <h4 className="ranking-zonas__titulo">Zonas con más usuarios</h4>
          <ol className="ranking-zonas__lista">
            {cuadros.slice(0, TOP_RANKING).map((c, i) => (
              <li key={`${c.lat},${c.lon}`}>
                <button
                  type="button"
                  className={`ranking-zonas__boton ${elegido === i ? 'ranking-zonas__boton--elegido' : ''}`}
                  onClick={() => accionesRef.current.seleccionar(i)}
                  aria-pressed={elegido === i}
                >
                  <span className="ranking-zonas__posicion">{i + 1}</span>
                  <span className="ranking-zonas__texto">
                    <span className="ranking-zonas__usuarios">{c.usuarios.toLocaleString('es-MX')} usuarios</span>
                    <span className="ranking-zonas__centro">
                      Centro en {c.lat.toFixed(1)}°, {c.lon.toFixed(1)}°
                    </span>
                    <span
                      className="ranking-zonas__barra"
                      style={{
                        '--proporcion': rango.maximo ? c.usuarios / rango.maximo : 0,
                        '--color': colorDeCuadro(razonDe(c.usuarios, rango.minimo, rango.maximo), gama),
                      }}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

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
        <TablaDatos tabla={tabla} fuente={fuente} />
      </div>
    </div>
  );
}
