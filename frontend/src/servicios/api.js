// Cliente HTTP base para consumir la API de COMMUNITY 360 según docs/CONTRATO_API.md.
// La sesión viaja únicamente en la cookie httpOnly c360_token (nunca en localStorage).

export class ErrorApi extends Error {
  constructor(mensaje, codigoHttp, datos = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigoHttp = codigoHttp;
    this.datos = datos;
  }
}

export async function peticionApi(ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo, senal } = opciones;

  const cabeceras = {
    Accept: 'application/json',
  };

  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }

  const respuesta = await fetch(ruta, {
    method: metodo,
    credentials: 'include',
    headers: cabeceras,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    signal: senal,
  });

  if (respuesta.status === 204) {
    return null;
  }

  let datos = null;
  const tipoContenido = respuesta.headers.get('content-type') || '';
  if (tipoContenido.includes('application/json')) {
    datos = await respuesta.json();
  }

  if (!respuesta.ok) {
    const detalle =
      typeof datos?.detail === 'string'
        ? datos.detail
        : `Error HTTP ${respuesta.status}`;
    throw new ErrorApi(detalle, respuesta.status, datos);
  }

  return datos;
}

export async function consultarSalud(senal) {
  try {
    return await peticionApi('/api/health', { senal });
  } catch (error) {
    if (
      error instanceof ErrorApi &&
      error.codigoHttp === 503 &&
      error.datos &&
      error.datos.estado === 'degradado'
    ) {
      return error.datos;
    }
    throw error;
  }
}

export async function iniciarSesion({ correo, password }, senal) {
  const datos = await peticionApi('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo, password },
    senal,
  });
  // La sesión queda establecida en la cookie httpOnly c360_token.
  // Se descarta datos.token para no guardarlo nunca en el navegador.
  return datos?.usuario ?? null;
}
