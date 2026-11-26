// Frases-resumen de las gráficas (HIG "Charting data"): se calculan con los datos reales
// de la API, con valores concretos y sin adjetivos subjetivos. Nunca texto fijo con números.
import {
  buscarLideres,
  formatearDecimal,
  formatearEntero,
  formatearPorcentaje,
  plural,
  unirNombres,
} from './formato';

export const NOMBRES_DIA = {
  1: 'el lunes',
  2: 'el martes',
  3: 'el miércoles',
  4: 'el jueves',
  5: 'el viernes',
  6: 'el sábado',
  7: 'el domingo',
};

// "Discord: 58 interacciones, la plataforma con más actividad."
// Con empate: "Discord y Twitch: 58 interacciones cada una, empatadas con más actividad."
function fraseLider(lideres, nombreDe, textoValor, rolUno, rolVarios, cada = 'cada uno') {
  if (!lideres) {
    return '';
  }
  const nombres = lideres.filas.map(nombreDe);
  if (nombres.length === 1) {
    return `${nombres[0]}: ${textoValor(lideres.filas[0])}, ${rolUno}.`;
  }
  return `${unirNombres(nombres)}: ${textoValor(lideres.filas[0])} ${cada}, ${rolVarios}.`;
}

export function resumenEstatus(datos, nombres) {
  const filas = datos?.datos;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.usuarios);
  if (!lideres) return 'Todavía no hay usuarios en el padrón.';
  return fraseLider(
    lideres,
    (f) => nombres[f.estatus] || f.estatus,
    (f) => `${formatearEntero(f.usuarios)} usuarios (${formatearPorcentaje(f.porcentaje)})`,
    'el estatus más común',
    'empatados como los más comunes'
  );
}

export function resumenGeografia(datos, nivel) {
  if (!datos) return '';
  const lista = (nivel === 'ciudades' ? datos.ciudades : datos.estados) || [];
  const lideres = buscarLideres(lista, (f) => f.usuarios);
  if (!lideres) {
    return `Ningún ${nivel === 'ciudades' ? 'lugar' : 'estado'} llega a ${datos.minimo_por_grupo} usuarios con consentimiento.`;
  }
  const esCiudad = nivel === 'ciudades';
  return fraseLider(
    lideres,
    (f) => (esCiudad ? `${f.ciudad}, ${f.estado}` : f.estado),
    (f) => `${formatearEntero(f.usuarios)} usuarios con consentimiento`,
    esCiudad ? 'la ciudad con más usuarios' : 'el estado con más usuarios',
    esCiudad ? 'empatadas con más usuarios' : 'empatados con más usuarios',
    esCiudad ? 'cada una' : 'cada uno'
  );
}

export function resumenPuntosCalientes(datos) {
  if (!datos || !Array.isArray(datos.datos)) return '';
  const visibles = `${formatearEntero(datos.usuarios_en_mapa)} de ${formatearEntero(
    datos.usuarios_con_coordenadas
  )} usuarios con coordenadas aparecen en el mapa, en ${formatearEntero(datos.datos.length)} ${plural(
    datos.datos.length,
    'cuadro',
    'cuadros'
  )}.`;
  const lideres = buscarLideres(datos.datos, (f) => f.usuarios);
  if (!lideres) return visibles;
  const primero = lideres.filas[0];
  const centro = `${formatearDecimal(primero.latitud_centro, 1)}°, ${formatearDecimal(primero.longitud_centro, 1)}°`;
  const lider =
    lideres.filas.length === 1
      ? `El cuadro con más usuarios reúne ${formatearEntero(lideres.valor)}, con centro en ${centro}.`
      : `${lideres.filas.length} cuadros empatan con ${formatearEntero(lideres.valor)} usuarios; uno tiene centro en ${centro}.`;
  return `${lider} ${visibles}`;
}

export function resumenPlataformas(datos, nombreDe) {
  const filas = datos?.datos;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.interacciones);
  if (!lideres) return 'Todavía no hay interacciones en ninguna plataforma.';
  return fraseLider(
    lideres,
    (f) => nombreDe(f.plataforma),
    (f) => `${formatearEntero(f.interacciones)} ${plural(f.interacciones, 'interacción', 'interacciones')}`,
    'la plataforma con más actividad',
    'empatadas con más actividad',
    'cada una'
  );
}

export function resumenTemas(datos, nombreDe, vista) {
  const filas = datos?.datos;
  if (!Array.isArray(filas)) return '';
  if (vista === 'sentimiento') {
    const conDatos = filas.filter((f) => f.sentimiento_promedio !== null && f.sentimiento_promedio !== undefined);
    if (conDatos.length === 0) return 'Ningún tema tiene interacciones todavía.';
    const maximo = Math.max(...conDatos.map((f) => Number(f.sentimiento_promedio)));
    const lideres = conDatos.filter((f) => Number(f.sentimiento_promedio) === maximo);
    const nombres = unirNombres(lideres.map((f) => nombreDe(f.tema)));
    return `${nombres}: sentimiento promedio de ${formatearDecimal(maximo, 3)}, ${
      lideres.length === 1 ? 'el más alto' : 'empatados como los más altos'
    }.`;
  }
  const lideres = buscarLideres(filas, (f) => f.interacciones);
  if (!lideres) return 'Todavía no hay interacciones en ningún tema.';
  return fraseLider(
    lideres,
    (f) => nombreDe(f.tema),
    (f) => `${formatearEntero(f.interacciones)} ${plural(f.interacciones, 'interacción', 'interacciones')}`,
    'el tema con más actividad',
    'empatados con más actividad'
  );
}

export function resumenTipos(datos) {
  const filas = datos?.datos;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.interacciones);
  if (!lideres) return 'Todavía no hay interacciones registradas.';
  return fraseLider(
    lideres,
    (f) => f.nombre || f.tipo,
    (f) =>
      `${formatearEntero(f.interacciones)} ${plural(f.interacciones, 'interacción', 'interacciones')} (${formatearPorcentaje(
        f.porcentaje
      )})`,
    'el tipo más frecuente',
    'empatados como los más frecuentes'
  );
}

export function resumenEtiquetas(datos) {
  const filas = datos?.datos;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.interacciones);
  if (!lideres) return 'Ninguna interacción lleva etiquetas todavía.';
  return fraseLider(
    lideres,
    (f) => f.nombre || f.etiqueta,
    (f) => `${formatearEntero(f.interacciones)} ${plural(f.interacciones, 'interacción', 'interacciones')}`,
    'la etiqueta más usada',
    'empatadas como las más usadas',
    'cada una'
  );
}

export function resumenActividad(datos) {
  const celdas = datos?.datos;
  if (!Array.isArray(celdas)) return '';
  const lideres = buscarLideres(celdas, (c) => c.interacciones);
  if (!lideres) return 'Todavía no hay interacciones registradas.';
  const primera = lideres.filas[0];
  const momento = `${NOMBRES_DIA[primera.dia_semana] ?? `el día ${primera.dia_semana}`} a las ${String(primera.hora).padStart(
    2,
    '0'
  )}:00 ${datos.zona_horaria || 'UTC'}`;
  const cantidad = `${formatearEntero(lideres.valor)} ${plural(lideres.valor, 'interacción', 'interacciones')}`;
  if (lideres.filas.length === 1) {
    return `La hora con más interacciones es ${momento}, con ${cantidad}.`;
  }
  return `${lideres.filas.length} horas empatan con ${cantidad}; la primera de la semana es ${momento}.`;
}

export function resumenEdad(datos) {
  const filas = datos?.rangos_edad;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.usuarios);
  if (!lideres) return 'Todavía no hay usuarios en el padrón.';
  return fraseLider(
    lideres,
    (f) => `${f.descripcion || f.rango_edad} años`,
    (f) => `${formatearEntero(f.usuarios)} usuarios (${formatearPorcentaje(f.porcentaje)})`,
    'el rango de edad más común',
    'empatados como los más comunes'
  );
}

export function resumenInteres(datos) {
  const filas = datos?.intereses;
  if (!Array.isArray(filas)) return '';
  const lideres = buscarLideres(filas, (f) => f.usuarios);
  if (!lideres) return 'Todavía no hay usuarios en el padrón.';
  return fraseLider(
    lideres,
    (f) => f.nombre || f.interes,
    (f) => `${formatearEntero(f.usuarios)} usuarios (${formatearPorcentaje(f.porcentaje)})`,
    'el interés principal más común',
    'empatados como los más comunes'
  );
}

export function resumenCruce(datos) {
  if (!datos || !Array.isArray(datos.cruce)) return '';
  const lideres = buscarLideres(datos.cruce, (f) => f.usuarios);
  if (!lideres) return 'Todavía no hay usuarios en el padrón.';
  const nombreRango = new Map((datos.rangos_edad || []).map((r) => [r.rango_edad, r.descripcion || r.rango_edad]));
  const nombreInteres = new Map((datos.intereses || []).map((i) => [i.interes, i.nombre || i.interes]));
  const primera = lideres.filas[0];
  const combinacion = `${nombreRango.get(primera.rango_edad) ?? primera.rango_edad} años con interés en ${
    nombreInteres.get(primera.interes) ?? primera.interes
  }`;
  const cantidad = `${formatearEntero(lideres.valor)} usuarios`;
  if (lideres.filas.length === 1) {
    return `La combinación más común es ${combinacion}: ${cantidad}.`;
  }
  return `${lideres.filas.length} combinaciones empatan con ${cantidad}; una es ${combinacion}.`;
}
