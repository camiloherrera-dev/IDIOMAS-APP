/**
 * Marcas de cambio local para la sincronización con la cuenta.
 *
 * Cada fila sincronizada lleva dos campos que pone un hook de Dexie al crearla o cambiarla:
 *   _ts  número creciente y único en este dispositivo: "cambió y falta subirla" si es mayor
 *        que lo ya subido. Las filas que llegan del servidor se guardan con _ts = 0.
 *   _m   hora de la última edición; viaja al servidor y desempata la fusión.
 */
import Dexie from 'dexie';

const KEY = 'lingo-stamp';
let last = 0;

function readLast(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/** siguiente marca: única y siempre mayor que la anterior, aunque el reloj retroceda */
export function nextStamp(): number {
  last = Math.max(Date.now(), last + 1, readLast() + 1);
  try {
    localStorage.setItem(KEY, String(last));
  } catch {
    /* sin almacenamiento: la marca solo vive en memoria */
  }
  return last;
}

const REMOTE = '__lingoRemote';

/** marca la transacción actual como "aplicando datos del servidor" (los hooks no la sellan) */
export function markRemoteTransaction() {
  const tx = Dexie.currentTransaction as unknown as Record<string, unknown> | null;
  if (tx) tx[REMOTE] = true;
}

export function isRemoteTransaction(tx: unknown): boolean {
  // las transacciones anidadas heredan la marca de la que las contiene
  for (let t = tx as Record<string, unknown> | null | undefined; t; t = t.parent as Record<string, unknown> | undefined) {
    if (t[REMOTE]) return true;
  }
  return false;
}

// ---------- aviso de cambios locales (el motor de sincronización se suscribe) ----------

const listeners = new Set<() => void>();
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyLocalChange() {
  for (const fn of listeners) fn();
}

/** instala los hooks de sellado en una tabla */
export function stampTable(table: Dexie.Table<Record<string, unknown>, unknown>) {
  table.hook('creating', function (_pk, obj: Record<string, unknown>, tx) {
    if (isRemoteTransaction(tx)) return;
    obj._ts = nextStamp();
    obj._m = Date.now();
    queueMicrotask(notifyLocalChange);
  });
  table.hook('updating', function (mods, _pk, _obj, tx) {
    if (isRemoteTransaction(tx)) return undefined;
    // una escritura que solo cambia las marcas no es un cambio del usuario
    if (Object.keys(mods).every((k) => k === '_ts' || k === '_m')) return undefined;
    queueMicrotask(notifyLocalChange);
    return { _ts: nextStamp(), _m: Date.now() };
  });
}
