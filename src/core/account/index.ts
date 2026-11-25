/**
 * Cuenta del usuario (Better Auth en /api/auth) y su relación con los datos de este dispositivo.
 *
 * La cuenta es opcional: sin ella la app funciona igual, solo en este dispositivo.
 * Los datos locales tienen dueño (`meta.owner`): si inicias sesión con otra cuenta en un
 * dispositivo que ya tiene progreso de alguien más, no se mezclan.
 */
import { createAuthClient } from 'better-auth/client';
import { db, type LingoDB } from '@/db';
import { onLocalChange } from '@/db/stamps';
import { disableSync, useSyncStore } from '@/db/sync';
import { getMeta, resetSyncCursors, setMeta, syncAccount, useAccountSync, wipeLocal } from '@/db/sync/account';
import { useAccount, type AccountUser } from './store';

export { useAccount, type AccountStatus, type AccountUser } from './store';

const BASE = import.meta.env.BASE_URL;
const origin = () => (typeof location === 'undefined' ? 'http://localhost' : location.origin);

let client: ReturnType<typeof createAuthClient> | null = null;
function auth() {
  client ??= createAuthClient({ baseURL: new URL(`${BASE}api/auth`, origin()).toString() });
  return client;
}

/** mensajes de error de Better Auth en español */
function explain(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? '';
  const map: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'El correo o la contraseña no coinciden.',
    USER_ALREADY_EXISTS: 'Ya hay una cuenta con ese correo. Inicia sesión.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya hay una cuenta con ese correo. Inicia sesión.',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres.',
    PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
    INVALID_EMAIL: 'Ese correo no es válido.',
    INVALID_PASSWORD: 'La contraseña no es correcta.',
    SESSION_EXPIRED: 'Por seguridad, vuelve a iniciar sesión y repite la acción.',
  };
  if (map[code]) return map[code];
  if (error?.status === 429) return 'Demasiados intentos. Espera un minuto.';
  if (error?.status === 503) return 'Las cuentas no están configuradas en este servidor.';
  return error?.message || 'No se pudo completar. Revisa tu conexión.';
}

// ---------- dueño de los datos de este dispositivo ----------

async function claimDevice(user: AccountUser, database: LingoDB): Promise<'ok' | 'conflict'> {
  const owner = await getMeta<string | null>(database, 'owner', null);
  if (owner === user.id) return 'ok';
  if (owner) return 'conflict';
  // datos sin dueño: se suben todos y se baja todo lo de la cuenta
  await setMeta(database, 'owner', user.id);
  await resetSyncCursors(database);
  return 'ok';
}

async function enter(user: AccountUser, database: LingoDB = db) {
  await setMeta(database, 'account', user);
  const claim = await claimDevice(user, database);
  if (claim === 'conflict') {
    useAccount.setState({ status: 'conflict', user, offline: false });
    return;
  }
  useAccountSync.setState({ lastSyncAt: await getMeta<number | null>(database, 'lastSyncAt', null) });
  useAccount.setState({ status: 'signedIn', user, offline: false });
  startScheduler();
  void syncAccount(database);
}

// ---------- arranque ----------

/** consulta el servidor y la sesión. Se llama una vez al abrir la app. */
export async function initAccount(database: LingoDB = db): Promise<void> {
  let config: { accounts?: boolean; google?: boolean } | null = null;
  try {
    const res = await fetch(`${BASE}api/config`, { credentials: 'same-origin' });
    if (res.ok && res.headers.get('content-type')?.includes('json')) config = await res.json();
  } catch {
    config = null;
  }
  const cached = await getMeta<AccountUser | null>(database, 'account', null);

  if (!config) {
    // sin red o sin servidor: si había sesión, se muestra la cuenta guardada
    if (cached && navigator.onLine === false) {
      useAccount.setState({ status: 'signedIn', user: cached, offline: true });
      startScheduler();
    } else useAccount.setState({ status: 'unavailable', user: null });
    return;
  }
  if (!config.accounts) {
    useAccount.setState({ status: 'unavailable', user: null });
    return;
  }
  useAccount.setState({ google: Boolean(config.google) });
  try {
    const { data } = await auth().getSession();
    if (data?.user) await enter({ id: data.user.id, name: data.user.name, email: data.user.email }, database);
    else useAccount.setState({ status: 'signedOut', user: null });
  } catch {
    if (cached) useAccount.setState({ status: 'signedIn', user: cached, offline: true });
    else useAccount.setState({ status: 'signedOut', user: null });
  }
}

// ---------- acciones ----------

export type Result = { ok: true } | { ok: false; error: string };

export async function signUp(name: string, email: string, password: string): Promise<Result> {
  const { data, error } = await auth().signUp.email({ name: name.trim() || email.split('@')[0], email: email.trim(), password });
  if (error || !data?.user) return { ok: false, error: explain(error) };
  await enter({ id: data.user.id, name: data.user.name, email: data.user.email });
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<Result> {
  const { data, error } = await auth().signIn.email({ email: email.trim(), password });
  if (error || !data?.user) return { ok: false, error: explain(error) };
  await enter({ id: data.user.id, name: data.user.name, email: data.user.email });
  return { ok: true };
}

/** redirige a Google; al volver, initAccount encuentra la sesión */
export async function signInWithGoogle(): Promise<Result> {
  const back = new URL(`${BASE}cuenta`, origin());
  const { error } = await auth().signIn.social({
    provider: 'google',
    callbackURL: back.toString(),
    errorCallbackURL: `${back.toString()}?error=google`,
  });
  return error ? { ok: false, error: explain(error) } : { ok: true };
}

/**
 * Cierra la sesión. Antes intenta subir lo pendiente.
 * `wipe`: borra también el progreso de este dispositivo (para un computador prestado).
 */
export async function signOut(wipe: boolean, database: LingoDB = db): Promise<Result> {
  // sube lo pendiente, solo si estos datos son de la cuenta que sale
  if (useAccount.getState().status === 'signedIn' && navigator.onLine !== false) await syncAccount(database);
  await auth()
    .signOut()
    .catch(() => null);
  await database.meta.delete('account');
  if (wipe) {
    await wipeLocal(database);
    disableSync();
  }
  useAccount.setState({ status: 'signedOut', user: null, offline: false });
  useAccountSync.setState({ state: 'idle', error: null });
  return { ok: true };
}

/** otra cuenta ya tiene datos en este dispositivo: se borran y se baja la nueva */
export async function replaceDeviceData(database: LingoDB = db): Promise<void> {
  const user = useAccount.getState().user;
  if (!user) return;
  await wipeLocal(database);
  disableSync();
  await setMeta(database, 'account', user);
  await enter(user, database);
}

/** borra la cuenta y su copia en la nube; el progreso queda en este dispositivo sin dueño */
export async function deleteAccount(password: string | undefined, database: LingoDB = db): Promise<Result> {
  const { error } = await auth().deleteUser(password ? { password } : {});
  if (error) return { ok: false, error: explain(error) };
  await database.meta.bulkDelete(['account', 'owner']);
  await resetSyncCursors(database);
  useAccount.setState({ status: 'signedOut', user: null });
  return { ok: true };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<Result> {
  const { error } = await auth().changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
  return error ? { ok: false, error: explain(error) } : { ok: true };
}

/** pasa el progreso de un código de sincronización (sistema anterior) a la cuenta */
export async function importLegacyCode(
  code: string,
  database: LingoDB = db,
): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE}api/legacy-import`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const body = (await res.json().catch(() => ({}))) as { imported?: number; error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `Error del servidor (${res.status}).` };
    if (useSyncStore.getState().code === code) disableSync();
    await syncAccount(database);
    return { ok: true, imported: body.imported ?? 0 };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}

// ---------- sincronización automática ----------

const INTERVAL = 5 * 60 * 1000;
const AFTER_CHANGE = 15 * 1000;
let started = false;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  if (useAccount.getState().status !== 'signedIn' || navigator.onLine === false) return;
  void syncAccount(db);
}

/** al volver a la app, al recuperar conexión, cada 5 min y 15 s después de estudiar */
function startScheduler() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // al volver a la app y al salir de ella (para subir lo pendiente)
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', () => {
    useAccount.setState({ offline: false });
    tick();
  });
  setInterval(() => document.visibilityState === 'visible' && tick(), INTERVAL);
  onLocalChange(() => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(tick, AFTER_CHANGE);
  });
}
