/** utilidades HTTP comunes a las funciones */
export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** lee un cuerpo JSON con límite de tamaño */
export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Datos demasiado grandes.');
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    /* sigue abajo */
  }
  throw new HttpError(400, 'Datos inválidos.');
}

/** convierte cualquier error en una respuesta JSON sin filtrar detalles internos */
export function fail(err: unknown): Response {
  if (err instanceof HttpError) return json(err.status, { error: err.message });
  console.error(err);
  return json(500, { error: 'Error del servidor.' });
}

/** solo se aceptan escrituras desde el mismo origen que la app */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // peticiones del mismo origen sin cabecera (algunos navegadores en GET)
  try {
    return new URL(origin).host === new URL(request.url).host || new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}
