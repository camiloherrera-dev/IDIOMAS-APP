/**
 * Sincronización por filas de la cuenta.
 *
 *   POST /api/rows   { rows: SyncRow[] }          → { applied, changed }   sube cambios
 *   GET  /api/rows?since=<seq>                    → { rows, next, more }   baja cambios
 *
 * Requiere sesión. La cabecera `x-device-id` identifica el dispositivo para no devolverle
 * sus propias escrituras.
 */
import { ROW_LIMITS, rowProblem, type SyncRow } from '../src/db/sync/merge.js';
import { accountsEnabled, sessionUser } from './_lib/auth.js';
import { asDb, getPool } from './_lib/db.js';
import { fail, HttpError, json, readJson, sameOrigin } from './_lib/http.js';
import { pullRows, pushRows } from './_lib/rowstore.js';
import { ensureSchema } from './_lib/schema.js';

function deviceOf(request: Request): string | null {
  const d = request.headers.get('x-device-id');
  return d && /^[A-Za-z0-9_-]{8,64}$/.test(d) ? d : null;
}

async function userOf(request: Request) {
  if (!accountsEnabled()) throw new HttpError(503, 'Las cuentas no están configuradas en este servidor.');
  await ensureSchema();
  const user = await sessionUser(request);
  if (!user) throw new HttpError(401, 'Inicia sesión para sincronizar.');
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await userOf(request);
    const url = new URL(request.url);
    const since = Number(url.searchParams.get('since') ?? 0);
    if (!Number.isSafeInteger(since) || since < 0) throw new HttpError(400, 'Cursor inválido.');
    const limit = Math.min(
      ROW_LIMITS.pullPage,
      Math.max(1, Number(url.searchParams.get('limit') ?? ROW_LIMITS.pullPage) || ROW_LIMITS.pullPage),
    );
    return json(200, await pullRows(asDb(getPool()), user.id, deviceOf(request), since, limit));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, 'Origen no permitido.');
    const user = await userOf(request);
    const body = await readJson(request, ROW_LIMITS.bodyBytes);
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length > ROW_LIMITS.batch)
      throw new HttpError(400, `Envía entre 1 y ${ROW_LIMITS.batch} filas.`);
    for (const r of rows) {
      const problem = rowProblem(r);
      if (problem) throw new HttpError(400, `Fila rechazada: ${problem}.`);
    }
    return json(200, await pushRows(asDb(getPool()), user.id, deviceOf(request), rows as SyncRow[]));
  } catch (err) {
    return fail(err);
  }
}
