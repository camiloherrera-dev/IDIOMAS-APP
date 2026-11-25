/**
 * Pasa el progreso de un código de sincronización (sistema anterior) a la cuenta.
 *   POST /api/legacy-import { code }  → { imported }
 */
import { SYNC_CODE_RE } from '../src/db/sync/merge.js';
import { accountsEnabled, sessionUser } from './_lib/auth.js';
import { asDb, getPool } from './_lib/db.js';
import { fail, HttpError, json, readJson, sameOrigin } from './_lib/http.js';
import { importLegacyCode } from './_lib/rowstore.js';
import { ensureSchema } from './_lib/schema.js';

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new HttpError(403, 'Origen no permitido.');
    if (!accountsEnabled()) throw new HttpError(503, 'Las cuentas no están configuradas en este servidor.');
    await ensureSchema();
    const user = await sessionUser(request);
    if (!user) throw new HttpError(401, 'Inicia sesión primero.');
    const body = await readJson(request, 1000);
    const code = typeof body.code === 'string' ? body.code : '';
    if (!SYNC_CODE_RE.test(code)) throw new HttpError(400, 'Código inválido.');
    const imported = await importLegacyCode(asDb(getPool()), user.id, code);
    if (imported === null) throw new HttpError(404, 'Ese código no existe o ya se importó.');
    return json(200, { imported });
  } catch (err) {
    return fail(err);
  }
}
