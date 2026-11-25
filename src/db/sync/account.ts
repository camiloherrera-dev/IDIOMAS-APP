/**
 * Sincronización por filas con la cuenta (Better Auth + Neon, API en /api/rows).
 *
 * - Subir: las filas con _ts mayor que lo ya subido (`pushedTs`), en lotes por orden de _ts.
 * - Bajar: lo del servidor con seq mayor que `cursor`, página a página; cada fila se fusiona
 *   con la local usando la misma regla que el servidor.
 * - Los datos siguen viviendo en IndexedDB: sin conexión o sin sesión, la app funciona igual
 *   y lo pendiente se sube al volver.
 */
import { create } from 'zustand';
import { db, STAMPED_TABLES, type LingoDB } from '../index';
import { markRemoteTransaction, nextStamp } from '../stamps';
import { cleanRow, mergeRow, ROW_LIMITS, ROW_TABLES, rowKey, sameData, type RowTable, type SyncRow } from './merge';

// ---------- metadatos del dispositivo ----------

export async function getMeta<T>(database: LingoDB, key: string, fallback: T): Promise<T> {
  const row = await database.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}
export const setMeta = (database: LingoDB, key: string, value: unknown) => database.meta.put({ key, value });

export async function deviceId(database: LingoDB = db): Promise<string> {
  let id = await getMeta<string | null>(database, 'deviceId', null);
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    await setMeta(database, 'deviceId', id);
  }
  return id;
}

// ---------- transporte ----------

export class AuthRequiredError extends Error {}
export class SyncHttpError extends Error {}

export interface RowsApi {
  push(rows: SyncRow[]): Promise<{ changed: SyncRow[] }>;
  pull(since: number): Promise<{ rows: SyncRow[]; next: number; more: boolean }>;
}

const ROWS_URL = `${import.meta.env.BASE_URL}api/rows`;

export function httpRowsApi(device: string, url = ROWS_URL): RowsApi {
  const call = async (input: string, init: RequestInit) => {
    let res: Response;
    try {
      res = await fetch(input, { ...init, credentials: 'same-origin', headers: { ...init.headers, 'x-device-id': device } });
    } catch {
      throw new SyncHttpError('Sin conexión con el servidor.');
    }
    if (res.status === 401) throw new AuthRequiredError('Tu sesión venció. Inicia sesión de nuevo para sincronizar.');
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) throw new SyncHttpError((body?.error as string | undefined) ?? `Error del servidor (${res.status}).`);
    return body;
  };
  return {
    push: async (rows) =>
      (await call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })) as {
        changed: SyncRow[];
      },
    pull: async (since) =>
      (await call(`${url}?since=${since}`, { method: 'GET' })) as { rows: SyncRow[]; next: number; more: boolean },
  };
}

// ---------- subir ----------

type Stamped = Record<string, unknown> & { _ts?: number };

function toSyncRow(tbl: (typeof STAMPED_TABLES)[number], row: Stamped): SyncRow {
  if (tbl === 'tombstones') return { tbl: row.tbl as RowTable, id: String(row.id), data: null, deleted: true };
  const data = cleanRow(tbl, row);
  return { tbl, id: rowKey(tbl, data), data };
}

/** filas pendientes más antiguas: hasta `limit`, sin cortar un grupo con la misma marca */
export async function pendingBatch(database: LingoDB, after: number, limit: number = ROW_LIMITS.batch) {
  const found: { tbl: (typeof STAMPED_TABLES)[number]; row: Stamped }[] = [];
  for (const tbl of STAMPED_TABLES) {
    const rows = (await database.table(tbl).where('_ts').above(after).limit(limit).toArray()) as Stamped[];
    for (const row of rows) found.push({ tbl, row });
  }
  found.sort((a, b) => (a.row._ts ?? 0) - (b.row._ts ?? 0));
  if (!found.length) return { rows: [] as SyncRow[], upTo: after };
  let take = found.slice(0, limit);
  const cut = take[take.length - 1].row._ts!;
  if (found.length >= limit) {
    // no partir un grupo de filas con la misma marca: se incluyen todas las de `cut`
    take = take.filter((f) => f.row._ts! < cut);
    for (const tbl of STAMPED_TABLES) {
      const same = (await database.table(tbl).where('_ts').equals(cut).toArray()) as Stamped[];
      for (const row of same) take.push({ tbl, row });
    }
  }
  return { rows: take.map((f) => toSyncRow(f.tbl, f.row)), upTo: cut };
}

export async function countPending(database: LingoDB = db): Promise<number> {
  const after = await getMeta(database, 'pushedTs', 0);
  let n = 0;
  for (const tbl of STAMPED_TABLES) n += await database.table(tbl).where('_ts').above(after).count();
  return n;
}

async function pushAll(database: LingoDB, api: RowsApi) {
  for (let guard = 0; guard < 10_000; guard++) {
    const after = await getMeta(database, 'pushedTs', 0);
    const { rows, upTo } = await pendingBatch(database, after);
    if (!rows.length) return;
    const { changed } = await api.push(rows);
    if (changed.length) await applyRemote(database, changed);
    await setMeta(database, 'pushedTs', upTo);
  }
}

// ---------- bajar y aplicar ----------

/** primary key local de una fila del servidor */
function localKey(tbl: RowTable, data: Record<string, unknown> | null, id: string): unknown {
  if (tbl === 'profile') return 'me';
  if (!data) return id;
  return tbl === 'lessonProgress' ? data.lessonId : tbl === 'dailyStats' || tbl === 'skills' ? data.key : data.id;
}

/**
 * Guarda filas que vienen del servidor. Si la versión local tiene algo más nuevo, el
 * resultado de la fusión queda marcado para volver a subir.
 */
export async function applyRemote(database: LingoDB, rows: SyncRow[]) {
  if (!rows.length) return;
  const tables = [...ROW_TABLES.map((t) => database.table(t)), database.tombstones];
  await database.transaction('rw', tables, async () => {
    markRemoteTransaction();
    for (const r of rows) {
      const table = database.table(r.tbl);
      if (r.deleted) {
        await table.delete(localKey(r.tbl, null, r.id) as string);
        continue;
      }
      const remote = r.data!;
      if (r.tbl === 'reviewLogs') {
        const exists = await database.reviewLogs
          .where('[cardId+reviewedAt]')
          .equals([remote.cardId as string, remote.reviewedAt as number])
          .count();
        if (!exists) await database.reviewLogs.add({ ...remote, _ts: 0 } as never);
        continue;
      }
      const key = localKey(r.tbl, remote, r.id);
      const local = (await table.get(key as string)) as Stamped | undefined;
      if (!local) {
        await table.put({ ...remote, _ts: 0 });
        continue;
      }
      const clean = cleanRow(r.tbl, local);
      const merged = mergeRow(r.tbl, clean, remote);
      if (sameData(merged, clean)) continue; // ya lo teníamos
      await table.put({ ...merged, _ts: sameData(merged, remote) ? 0 : nextStamp() });
    }
  });
}

async function pullAll(database: LingoDB, api: RowsApi) {
  for (let guard = 0; guard < 10_000; guard++) {
    const since = await getMeta(database, 'cursor', 0);
    const page = await api.pull(since);
    await applyRemote(database, page.rows);
    await setMeta(database, 'cursor', page.next);
    if (!page.more) return;
  }
}

// ---------- estado y ciclo ----------

export type AccountSyncState = 'idle' | 'syncing' | 'error' | 'auth';

interface AccountSyncStore {
  state: AccountSyncState;
  lastSyncAt: number | null;
  error: string | null;
}

export const useAccountSync = create<AccountSyncStore>(() => ({ state: 'idle', lastSyncAt: null, error: null }));

let running: Promise<boolean> | null = null;

/** sube lo pendiente y baja lo nuevo. Nunca lanza; devuelve true si salió bien. */
export function syncAccount(database: LingoDB = db, api?: RowsApi): Promise<boolean> {
  if (running) return running;
  useAccountSync.setState({ state: 'syncing', error: null });
  running = (async () => {
    try {
      const rowsApi = api ?? httpRowsApi(await deviceId(database));
      await pushAll(database, rowsApi);
      await pullAll(database, rowsApi);
      const now = Date.now();
      await setMeta(database, 'lastSyncAt', now);
      useAccountSync.setState({ state: 'idle', lastSyncAt: now, error: null });
      return true;
    } catch (err) {
      if (err instanceof AuthRequiredError) useAccountSync.setState({ state: 'auth', error: err.message });
      else useAccountSync.setState({ state: 'error', error: err instanceof Error ? err.message : 'No se pudo sincronizar.' });
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** reinicia los cursores: todo lo local se volverá a subir y todo lo de la cuenta se bajará */
export async function resetSyncCursors(database: LingoDB = db) {
  await setMeta(database, 'pushedTs', 0);
  await setMeta(database, 'cursor', 0);
}

/** borra todo el progreso de este dispositivo (conserva su id) */
export async function wipeLocal(database: LingoDB = db) {
  const tables = [...STAMPED_TABLES.map((t) => database.table(t)), database.meta];
  const device = await getMeta<string | null>(database, 'deviceId', null);
  await database.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear();
    if (device) await setMeta(database, 'deviceId', device);
  });
}
