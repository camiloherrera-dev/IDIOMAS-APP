/**
 * Función serverless (Vercel) que guarda el progreso en Neon (Postgres).
 *
 *   POST   /api/sync  { code, mode, snapshot }  → { snapshot }   fusiona y devuelve
 *   DELETE /api/sync  { code }                   → { ok: true }   borra los datos
 *
 * Variables de entorno: DATABASE_URL (cadena de conexión de Neon).
 * Opcional: ALLOWED_ORIGINS (orígenes permitidos separados por coma; por defecto *).
 *
 * El código nunca se guarda: la fila se identifica con su SHA-256.
 */
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { emptySnapshot, isSnapshot, mergeSnapshots, SYNC_CODE_RE, type SyncSnapshot } from '../src/db/sync/merge.js';

const MAX_BYTES = 4 * 1024 * 1024;

function cors(request: Request): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const origin = request.headers.get('origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (request: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) },
  });

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable DATABASE_URL');
  return neon(url);
}

let tableReady: Promise<unknown> | null = null;
function ensureTable(sql: ReturnType<typeof db>) {
  tableReady ??= sql`
    CREATE TABLE IF NOT EXISTS lingo_sync (
      id         text PRIMARY KEY,
      data       jsonb NOT NULL,
      version    integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`.catch((err: unknown) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

const hashCode = (code: string) => createHash('sha256').update(`lingo-lab:${code}`).digest('hex');

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BYTES) throw Object.assign(new Error('too large'), { status: 413 });
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const code = typeof body?.code === 'string' ? body.code : '';
    const mode = body?.mode === 'create' || body?.mode === 'link' ? body.mode : 'sync';
    if (!SYNC_CODE_RE.test(code)) return json(request, 400, { error: 'Código de sincronización inválido.' });
    if (!isSnapshot(body?.snapshot)) return json(request, 400, { error: 'Datos inválidos.' });
    const incoming = body.snapshot as SyncSnapshot;

    const sql = db();
    await ensureTable(sql);
    const id = hashCode(code);

    // concurrencia optimista: si otro dispositivo escribió entre la lectura y la escritura, se reintenta
    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = (await sql`SELECT data, version FROM lingo_sync WHERE id = ${id}`) as { data: unknown; version: number }[];
      if (!rows.length) {
        if (mode === 'link') return json(request, 404, { error: 'Ese código no existe.' });
        const merged = mergeSnapshots(emptySnapshot(), incoming);
        const ins = await sql`
          INSERT INTO lingo_sync (id, data) VALUES (${id}, ${JSON.stringify(merged)}::jsonb)
          ON CONFLICT (id) DO NOTHING RETURNING version`;
        if ((ins as unknown[]).length) return json(request, 200, { snapshot: merged });
        continue;
      }
      const stored = isSnapshot(rows[0].data) ? rows[0].data : emptySnapshot();
      const merged = mergeSnapshots(stored, incoming);
      const upd = await sql`
        UPDATE lingo_sync
        SET data = ${JSON.stringify(merged)}::jsonb, version = version + 1, updated_at = now()
        WHERE id = ${id} AND version = ${rows[0].version}
        RETURNING version`;
      if ((upd as unknown[]).length) return json(request, 200, { snapshot: merged });
    }
    return json(request, 409, { error: 'Otro dispositivo está sincronizando. Inténtalo en unos segundos.' });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 413) return json(request, 413, { error: 'Datos demasiado grandes.' });
    console.error(err);
    return json(request, 500, { error: 'Error del servidor de sincronización.' });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readBody(request);
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!SYNC_CODE_RE.test(code)) return json(request, 400, { error: 'Código de sincronización inválido.' });
    const sql = db();
    await ensureTable(sql);
    await sql`DELETE FROM lingo_sync WHERE id = ${hashCode(code)}`;
    return json(request, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(request, 500, { error: 'Error del servidor de sincronización.' });
  }
}
