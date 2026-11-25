/**
 * Almacén de filas de sincronización en Postgres (Neon en producción, PGlite en las pruebas).
 *
 * Cada usuario tiene sus filas en `lingo_rows`. Cada escritura toma un número nuevo de la
 * secuencia `lingo_sync_seq`: un dispositivo pide "lo de mi usuario con seq mayor que el
 * último que vi", así que no hace falta comparar relojes entre dispositivos.
 */
import { createHash } from 'node:crypto';
import {
  isSnapshot,
  mergeRow,
  ROW_LIMITS,
  sameData,
  snapshotToRows,
  type RowTable,
  type SyncRow,
} from '../../src/db/sync/merge.js';

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Sql {
  /** ejecuta `fn` dentro de una transacción */
  tx<T>(fn: (q: Sql) => Promise<T>): Promise<T>;
}

export const ROWS_DDL = [
  `CREATE SEQUENCE IF NOT EXISTS lingo_sync_seq`,
  `CREATE TABLE IF NOT EXISTS lingo_rows (
     user_id    text        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
     tbl        text        NOT NULL,
     row_id     text        NOT NULL,
     data       jsonb,
     deleted    boolean     NOT NULL DEFAULT false,
     seq        bigint      NOT NULL,
     device_id  text,
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, tbl, row_id)
   )`,
  `CREATE INDEX IF NOT EXISTS lingo_rows_pull ON lingo_rows (user_id, seq)`,
];

const key = (tbl: string, id: string) => `${tbl}\u0000${id}`;

export interface PushResult {
  /** filas que se escribieron */
  applied: number;
  /** filas cuyo resultado en el servidor es distinto de lo que envió el dispositivo */
  changed: SyncRow[];
}

/**
 * Fusiona las filas recibidas con las guardadas. Un borrado es definitivo.
 * `deviceId` marca quién escribió la versión guardada, para no devolvérsela en el pull;
 * con `null` todos los dispositivos la reciben.
 */
export async function pushRows(db: Db, userId: string, deviceId: string | null, input: SyncRow[]): Promise<PushResult> {
  // si la misma fila viene dos veces en el lote, se fusionan
  const incoming = new Map<string, SyncRow>();
  for (const r of input) {
    const k = key(r.tbl, r.id);
    const prev = incoming.get(k);
    if (!prev || r.deleted || prev.deleted) incoming.set(k, r.deleted || prev?.deleted ? { ...r, data: null, deleted: true } : r);
    else incoming.set(k, { ...r, data: mergeRow(r.tbl, prev.data!, r.data!) });
  }
  if (!incoming.size) return { applied: 0, changed: [] };
  const list = [...incoming.values()];

  return db.tx(async (q) => {
    // un usuario a la vez: evita que dos dispositivos pisen la misma fila nueva
    await q.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [userId]);
    const found = await q.query<{ tbl: string; row_id: string; data: Record<string, unknown> | null; deleted: boolean }>(
      `SELECT tbl, row_id, data, deleted FROM lingo_rows
       WHERE user_id = $1 AND (tbl, row_id) IN (SELECT * FROM unnest($2::text[], $3::text[]))`,
      [userId, list.map((r) => r.tbl), list.map((r) => r.id)],
    );
    const stored = new Map(found.rows.map((r) => [key(r.tbl, r.row_id), r]));

    const writes: { tbl: RowTable; id: string; data: Record<string, unknown> | null; deleted: boolean; device: string | null }[] =
      [];
    const changed: SyncRow[] = [];
    for (const r of list) {
      const s = stored.get(key(r.tbl, r.id));
      if (s?.deleted) {
        if (!r.deleted) changed.push({ tbl: r.tbl, id: r.id, data: null, deleted: true });
        continue;
      }
      if (r.deleted) {
        writes.push({ tbl: r.tbl, id: r.id, data: null, deleted: true, device: deviceId });
        continue;
      }
      const merged = s?.data ? mergeRow(r.tbl, s.data, r.data!) : r.data!;
      const sameAsIncoming = sameData(merged, r.data);
      if (!sameAsIncoming) changed.push({ tbl: r.tbl, id: r.id, data: merged });
      if (s?.data && sameData(merged, s.data)) continue; // el servidor ya lo tenía
      writes.push({ tbl: r.tbl, id: r.id, data: merged, deleted: false, device: sameAsIncoming ? deviceId : null });
    }

    if (writes.length) {
      await q.query(
        `INSERT INTO lingo_rows (user_id, tbl, row_id, data, deleted, seq, device_id, updated_at)
         SELECT $1, t.tbl, t.row_id, t.data::jsonb, t.deleted, nextval('lingo_sync_seq'), t.device_id, now()
         FROM unnest($2::text[], $3::text[], $4::text[], $5::boolean[], $6::text[]) AS t(tbl, row_id, data, deleted, device_id)
         ON CONFLICT (user_id, tbl, row_id) DO UPDATE
           SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, seq = EXCLUDED.seq,
               device_id = EXCLUDED.device_id, updated_at = now()`,
        [
          userId,
          writes.map((w) => w.tbl),
          writes.map((w) => w.id),
          writes.map((w) => (w.data ? JSON.stringify(w.data) : null)),
          writes.map((w) => w.deleted),
          writes.map((w) => w.device),
        ],
      );
    }
    return { applied: writes.length, changed };
  });
}

export interface PullResult {
  rows: SyncRow[];
  /** cursor para la siguiente llamada */
  next: number;
  more: boolean;
}

/** filas del usuario con seq mayor que `since`, salvo las que escribió este mismo dispositivo */
export async function pullRows(
  db: Sql,
  userId: string,
  deviceId: string | null,
  since: number,
  limit: number = ROW_LIMITS.pullPage,
): Promise<PullResult> {
  const res = await db.query<{
    seq: string | number;
    tbl: RowTable;
    row_id: string;
    data: Record<string, unknown> | null;
    deleted: boolean;
    device_id: string | null;
  }>(
    `SELECT seq, tbl, row_id, device_id,
            CASE WHEN device_id IS NOT NULL AND device_id = $3 THEN NULL ELSE data END AS data,
            deleted
     FROM lingo_rows WHERE user_id = $1 AND seq > $2 ORDER BY seq LIMIT $4`,
    [userId, since, deviceId, limit + 1],
  );
  const more = res.rows.length > limit;
  const page = more ? res.rows.slice(0, limit) : res.rows;
  const next = page.length ? Number(page[page.length - 1].seq) : since;
  const rows = page
    .filter((r) => !(deviceId && r.device_id === deviceId))
    .map((r) =>
      r.deleted ? { tbl: r.tbl, id: r.row_id, data: null, deleted: true } : { tbl: r.tbl, id: r.row_id, data: r.data },
    );
  return { rows, next, more };
}

/** misma función de hash que usaba el sistema de códigos (api/sync.ts) */
export const hashSyncCode = (code: string) => createHash('sha256').update(`lingo-lab:${code}`).digest('hex');

/**
 * Pasa el progreso guardado con un código de sincronización a la cuenta. La fila antigua
 * solo se borra si la importación terminó bien. Devuelve cuántas filas se importaron, o null
 * si el código no existe.
 */
export async function importLegacyCode(db: Db, userId: string, code: string): Promise<number | null> {
  const exists = await db.query<{ t: string | null }>(`SELECT to_regclass('lingo_sync')::text AS t`);
  if (!exists.rows[0]?.t) return null;
  const id = hashSyncCode(code);
  const found = await db.query<{ data: unknown }>(`SELECT data FROM lingo_sync WHERE id = $1`, [id]);
  if (!found.rows.length || !isSnapshot(found.rows[0].data)) return null;
  const rows = snapshotToRows(found.rows[0].data);
  let total = 0;
  for (let i = 0; i < rows.length; i += ROW_LIMITS.batch) {
    total += (await pushRows(db, userId, null, rows.slice(i, i + ROW_LIMITS.batch))).applied;
  }
  await db.query(`DELETE FROM lingo_sync WHERE id = $1`, [id]);
  return total;
}
