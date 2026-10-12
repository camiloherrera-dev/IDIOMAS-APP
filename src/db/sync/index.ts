/**
 * Sincronización en la nube (Neon) con un "código de sincronización".
 *
 * - Los datos siguen viviendo en IndexedDB: la app funciona igual sin internet.
 * - Al sincronizar se envía una foto de los datos locales a `/api/sync`; el servidor
 *   la fusiona con la que tiene guardada y devuelve el resultado, que se fusiona
 *   de nuevo con lo local (por si cambió algo mientras tanto).
 * - El código (100 bits aleatorios) es la llave: quien lo tenga ve ese progreso.
 */
import { create } from 'zustand';
import { db, type LingoDB } from '../index';
import {
  emptySnapshot,
  generateSyncCode,
  isSnapshot,
  mergeSnapshots,
  normalizeSyncCode,
  reviewLogKey,
  SYNC_TABLES,
  SYNC_VERSION,
  type SyncSnapshot,
} from './merge';

export { generateSyncCode, normalizeSyncCode };

const KEY_CODE = 'lingo-sync-code';
const KEY_LAST = 'lingo-sync-last';
const KEY_DELETED = 'lingo-sync-deleted';

export const SYNC_URL: string = import.meta.env.VITE_SYNC_URL || `${import.meta.env.BASE_URL}api/sync`;

// ---------- almacenamiento pequeño (localStorage puede fallar en modo privado) ----------

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: la sincronización solo dura esta sesión */
  }
}

function readDeleted(): string[] {
  try {
    const raw = JSON.parse(readLS(KEY_DELETED) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** registra un borrado para que no "resucite" al sincronizar con otro dispositivo */
export function recordDeletion(...keys: string[]) {
  writeLS(KEY_DELETED, JSON.stringify([...new Set([...readDeleted(), ...keys])]));
}

// ---------- estado observable ----------

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

interface SyncStore {
  code: string | null;
  lastSyncAt: number | null;
  state: SyncState;
  error: string | null;
}

export const useSyncStore = create<SyncStore>(() => {
  const code = normalizeSyncCode(readLS(KEY_CODE) ?? '');
  const last = Number(readLS(KEY_LAST));
  return { code, lastSyncAt: last > 0 ? last : null, state: code ? 'idle' : 'off', error: null };
});

// ---------- foto local y aplicación del resultado ----------

export async function localSnapshot(database: LingoDB = db): Promise<SyncSnapshot> {
  const snap = emptySnapshot();
  const t = snap.tables as unknown as Record<string, unknown[]>;
  for (const name of SYNC_TABLES) t[name] = await database.table(name).toArray();
  snap.tables.reviewLogs = (await database.reviewLogs.toArray()).map(({ id: _id, ...rest }) => rest);
  snap.deleted = readDeleted();
  return snap;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** fusiona `remote` con lo que haya ahora en IndexedDB y escribe solo lo que cambió */
export async function applySnapshot(remote: SyncSnapshot, database: LingoDB = db): Promise<void> {
  await database.transaction(
    'rw',
    SYNC_TABLES.map((t) => database.table(t)),
    async () => {
      const local = await localSnapshot(database);
      const merged = mergeSnapshots(local, remote);

      const keyed: Record<string, (row: Record<string, unknown>) => string> = {
        profile: () => 'me',
        cards: (r) => String(r.id),
        lessonProgress: (r) => String(r.lessonId),
        customTerms: (r) => String(r.id),
        dailyStats: (r) => String(r.key),
        achievements: (r) => String(r.id),
      };
      for (const [name, key] of Object.entries(keyed)) {
        const before = new Map(
          ((local.tables as unknown as Record<string, Record<string, unknown>[]>)[name] ?? []).map((r) => [key(r), r]),
        );
        const rows = (merged.tables as unknown as Record<string, Record<string, unknown>[]>)[name];
        const changed = rows.filter((r) => !same(before.get(key(r)), r));
        if (changed.length) await database.table(name).bulkPut(changed);
      }

      // historial de repasos: solo se agregan los que faltan
      const known = new Set(local.tables.reviewLogs.map(reviewLogKey));
      const missing = merged.tables.reviewLogs.filter((r) => !known.has(reviewLogKey(r)));
      if (missing.length) await database.reviewLogs.bulkAdd(missing);

      // borrados que vienen de otro dispositivo
      for (const d of merged.deleted) {
        const [table, ...rest] = d.split(':');
        const id = rest.join(':');
        if (table === 'cards') await database.cards.delete(id);
        if (table === 'customTerms') await database.customTerms.delete(id);
      }
      writeLS(KEY_DELETED, JSON.stringify(merged.deleted));
    },
  );
}

// ---------- llamadas al servidor ----------

class SyncError extends Error {}

async function callServer(code: string, snapshot: SyncSnapshot, mode: 'create' | 'link' | 'sync'): Promise<SyncSnapshot> {
  let res: Response;
  try {
    res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, mode, snapshot }),
    });
  } catch {
    throw new SyncError('Sin conexión con el servidor de sincronización.');
  }
  if (res.status === 404 && mode === 'link') throw new SyncError('Ese código no existe. Revísalo e inténtalo de nuevo.');
  if (res.status === 404) throw new SyncError('El servidor de sincronización no está configurado (falta /api/sync).');
  if (res.status === 413) throw new SyncError('Tus datos son demasiado grandes para sincronizar de una vez.');
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new SyncError(msg ?? `Error del servidor (${res.status}).`);
  }
  const body = (await res.json()) as { snapshot?: unknown };
  if (!isSnapshot(body.snapshot)) throw new SyncError('Respuesta inválida del servidor.');
  if (body.snapshot.v > SYNC_VERSION) throw new SyncError('Actualiza la app para seguir sincronizando.');
  return body.snapshot;
}

let running: Promise<boolean> | null = null;

/** sincroniza ahora. Devuelve true si salió bien. Nunca lanza. */
export function syncNow(mode: 'create' | 'link' | 'sync' = 'sync', codeOverride?: string): Promise<boolean> {
  if (running) return running;
  const code = codeOverride ?? useSyncStore.getState().code;
  if (!code) return Promise.resolve(false);
  useSyncStore.setState({ state: 'syncing', error: null });
  running = (async () => {
    try {
      const snapshot = await localSnapshot();
      const merged = await callServer(code, snapshot, mode);
      await applySnapshot(merged);
      const now = Date.now();
      writeLS(KEY_CODE, code);
      writeLS(KEY_LAST, String(now));
      useSyncStore.setState({ code, lastSyncAt: now, state: 'idle', error: null });
      return true;
    } catch (err) {
      const error = err instanceof SyncError ? err.message : 'No se pudo sincronizar.';
      // al crear o vincular, si falla no se guarda el código
      useSyncStore.setState((s) => ({ state: s.code ? 'error' : 'off', error }));
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** crea un código nuevo y sube el progreso de este dispositivo */
export async function enableSync(): Promise<boolean> {
  return syncNow('create', generateSyncCode());
}

/**
 * vincula este dispositivo a un código existente. El perfil de la nube tiene
 * prioridad (nombre, meta, tema) sobre el recién creado en este dispositivo.
 */
export async function linkSync(input: string): Promise<{ ok: boolean; error?: string }> {
  const code = normalizeSyncCode(input);
  if (!code) return { ok: false, error: 'El código tiene 20 letras y números, como ABCD-EFGH-JKLM-NPQR-STUV.' };
  const p = await db.profile.get('me');
  if (p) await db.profile.put({ ...p, updatedAt: 0 });
  const ok = await syncNow('link', code);
  return ok ? { ok } : { ok, error: useSyncStore.getState().error ?? undefined };
}

/** deja de sincronizar en este dispositivo (los datos de la nube se conservan) */
export function disableSync() {
  writeLS(KEY_CODE, null);
  writeLS(KEY_LAST, null);
  useSyncStore.setState({ code: null, lastSyncAt: null, state: 'off', error: null });
}

/** borra los datos de la nube asociados al código y desvincula este dispositivo */
export async function deleteCloudData(): Promise<boolean> {
  const code = useSyncStore.getState().code;
  if (!code) return false;
  try {
    const res = await fetch(SYNC_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return false;
    disableSync();
    return true;
  } catch {
    return false;
  }
}

// ---------- sincronización automática ----------

const AUTO_INTERVAL = 5 * 60 * 1000;
let started = false;

/** sincroniza al abrir, al volver a la app, al recuperar conexión, al salir y cada 5 min */
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const tick = () => {
    if (useSyncStore.getState().code && navigator.onLine !== false) void syncNow();
  };
  setTimeout(tick, 1500);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);
  setInterval(() => document.visibilityState === 'visible' && tick(), AUTO_INTERVAL);
}
