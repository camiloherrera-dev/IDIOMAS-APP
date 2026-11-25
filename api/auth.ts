/**
 * Better Auth: registro, inicio de sesión, Google, sesión y cierre.
 *
 * Vercel no tiene rutas "catch-all" en /api fuera de Next.js, así que vercel.json reescribe
 * /api/auth/<ruta> a /api/auth?__auth=<ruta> y aquí se reconstruye la URL original.
 */
import { accountsEnabled, getAuth } from './_lib/auth.js';
import { fail, json } from './_lib/http.js';
import { ensureSchema } from './_lib/schema.js';

function restoreUrl(request: Request): Request {
  const url = new URL(request.url);
  const path = url.searchParams.get('__auth');
  if (path === null) return request;
  url.searchParams.delete('__auth');
  url.pathname = `/api/auth/${path.replace(/^\/+/, '')}`;
  return new Request(url, request);
}

async function handle(request: Request): Promise<Response> {
  if (!accountsEnabled()) return json(503, { error: 'Las cuentas no están configuradas en este servidor.' });
  try {
    await ensureSchema();
    return await getAuth().handler(restoreUrl(request));
  } catch (err) {
    return fail(err);
  }
}

export const GET = handle;
export const POST = handle;
