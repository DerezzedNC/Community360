// Formatos de presentación compartidos. Solo dan forma a datos que llegan de la API:
// nunca inventan valores.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearEntero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString('es-MX') : '—';
}

export function formatearDecimal(valor, decimales) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—';
}

export function formatearPorcentaje(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${numero.toFixed(1)} %` : '—';
}

// "2026-11-25T20:15:00Z" → "25 nov 2026, 20:15 UTC" (las marcas de la API están en UTC)
export function formatearFechaHoraUtc(texto) {
  if (typeof texto !== 'string' || !texto) {
    return '—';
  }
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) {
    return texto;
  }
  const hora = `${String(fecha.getUTCHours()).padStart(2, '0')}:${String(fecha.getUTCMinutes()).padStart(2, '0')}`;
  return `${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}, ${hora} UTC`;
}

// "2026-11-08" → "8 nov 2026" (fechas sin hora de TiDB)
export function formatearFecha(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    return texto || '—';
  }
  const [anio, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  return `${dia} ${MESES[mes - 1] ?? ''} ${anio}`;
}

export function formatearTiempoRelativo(momentoMs, ahoraMs) {
  const segundos = Math.max(0, Math.round((ahoraMs - momentoMs) / 1000));
  if (segundos < 5) {
    return 'hace un momento';
  }
  if (segundos < 60) {
    return `hace ${segundos} s`;
  }
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    return `hace ${minutos} min`;
  }
  return `hace ${Math.floor(minutos / 60)} h`;
}

// Recorta por el centro los ID largos para conservar inicio y fin: "q_0a1b…6a7b"
export function recortarId(id, maximo = 12) {
  const texto = String(id ?? '');
  if (texto.length <= maximo) {
    return texto;
  }
  const lado = Math.floor((maximo - 1) / 2);
  return `${texto.slice(0, lado)}…${texto.slice(-lado)}`;
}

// Une nombres en español: "A", "A y B", "A, B y C"
export function unirNombres(nombres) {
  if (nombres.length <= 1) {
    return nombres[0] ?? '';
  }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

// Filas con el valor más alto (puede haber empate). Devuelve null si no hay valores mayores a 0.
export function buscarLideres(filas, obtenerValor) {
  let maximo = -Infinity;
  for (const fila of filas) {
    const valor = Number(obtenerValor(fila));
    if (Number.isFinite(valor) && valor > maximo) {
      maximo = valor;
    }
  }
  if (!Number.isFinite(maximo) || maximo <= 0) {
    return null;
  }
  return {
    valor: maximo,
    filas: filas.filter((fila) => Number(obtenerValor(fila)) === maximo),
  };
}

export function plural(cantidad, singular, pluralTexto) {
  return Number(cantidad) === 1 ? singular : pluralTexto;
}
