/**
 * Fusión de datos entre dispositivos. Este archivo es puro (sin Dexie ni React):
 * lo usan la app y la función serverless `api/sync.ts`.
 *
 * La fusión es conmutativa e idempotente: no importa en qué orden lleguen los
 * cambios de cada dispositivo, el resultado es el mismo.
 */
import type { AchievementRow, CardRow, CustomTermRow, DailyStatRow, LessonProgressRow, Profile, ReviewLogRow } from '../index';

export const SYNC_VERSION = 1;

export interface SyncTables {
  profile: Profile[];
  cards: CardRow[];
  reviewLogs: Omit<ReviewLogRow, 'id'>[];
  lessonProgress: LessonProgressRow[];
  customTerms: CustomTermRow[];
  dailyStats: DailyStatRow[];
  achievements: AchievementRow[];
}

export interface SyncSnapshot {
  v: number;
  tables: SyncTables;
  /** lápidas de borrados: "customTerms:<id>" y "cards:<id>" */
  deleted: string[];
}

export const SYNC_TABLES = [
  'profile',
  'cards',
  'reviewLogs',
  'lessonProgress',
  'customTerms',
  'dailyStats',
  'achievements',
] as const satisfies readonly (keyof SyncTables)[];

export function emptySnapshot(): SyncSnapshot {
  return {
    v: SYNC_VERSION,
    tables: { profile: [], cards: [], reviewLogs: [], lessonProgress: [], customTerms: [], dailyStats: [], achievements: [] },
    deleted: [],
  };
}

/** fusiona dos listas por clave con una función que elige/combina filas */
function mergeBy<T>(a: T[], b: T[], key: (row: T) => string, pick: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>();
  for (const row of a) map.set(key(row), row);
  for (const row of b) {
    const k = key(row);
    const prev = map.get(k);
    map.set(k, prev === undefined ? row : pick(prev, row));
  }
  return [...map.values()];
}

const profileTime = (p: Profile) => p.updatedAt ?? p.createdAt ?? 0;

function pickProfile(a: Profile, b: Profile): Profile {
  // gana el perfil editado más recientemente; los idiomas se unen
  const [newer, older] = profileTime(b) > profileTime(a) ? [b, a] : [a, b];
  const langs = [...new Set([...newer.langs, ...older.langs])];
  return { ...newer, langs, onboarded: newer.onboarded || older.onboarded };
}

function pickCard(a: CardRow, b: CardRow): CardRow {
  // gana la tarjeta repasada más recientemente; en empate, la de más repasos
  const ra = a.last_review ?? 0;
  const rb = b.last_review ?? 0;
  if (ra !== rb) return rb > ra ? b : a;
  if (a.reps !== b.reps) return b.reps > a.reps ? b : a;
  return b.due > a.due ? b : a;
}

const pickLesson = (a: LessonProgressRow, b: LessonProgressRow): LessonProgressRow => ({
  ...a,
  bestScore: Math.max(a.bestScore, b.bestScore),
  completedAt: Math.min(a.completedAt, b.completedAt),
});

const pickStat = (a: DailyStatRow, b: DailyStatRow): DailyStatRow => ({
  ...a,
  xp: Math.max(a.xp, b.xp),
  ms: Math.max(a.ms, b.ms),
  reviews: Math.max(a.reviews, b.reviews),
  answered: Math.max(a.answered, b.answered),
  correct: Math.max(a.correct, b.correct),
});

export const reviewLogKey = (r: Pick<ReviewLogRow, 'cardId' | 'reviewedAt'>) => `${r.cardId}|${r.reviewedAt}`;

const stripId = ({ id: _id, ...rest }: ReviewLogRow) => rest;

export function mergeSnapshots(a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot {
  const deleted = [...new Set([...a.deleted, ...b.deleted])].sort();
  const gone = new Set(deleted);
  const A = a.tables;
  const B = b.tables;

  const profile = mergeBy(A.profile, B.profile, () => 'me', pickProfile);
  const cards = mergeBy(A.cards, B.cards, (c) => c.id, pickCard).filter((c) => !gone.has(`cards:${c.id}`));
  const reviewLogs = mergeBy(
    A.reviewLogs.map((r) => stripId(r as ReviewLogRow)),
    B.reviewLogs.map((r) => stripId(r as ReviewLogRow)),
    reviewLogKey,
    (x) => x,
  ).sort((x, y) => x.reviewedAt - y.reviewedAt);
  const lessonProgress = mergeBy(A.lessonProgress, B.lessonProgress, (l) => l.lessonId, pickLesson);
  const customTerms = mergeBy(
    A.customTerms,
    B.customTerms,
    (t) => t.id,
    (x, y) => (y.createdAt > x.createdAt ? y : x),
  ).filter((t) => !gone.has(`customTerms:${t.id}`));
  const dailyStats = mergeBy(A.dailyStats, B.dailyStats, (s) => s.key, pickStat);
  const achievements = mergeBy(
    A.achievements,
    B.achievements,
    (x) => x.id,
    (x, y) => (y.unlockedAt < x.unlockedAt ? y : x),
  );

  return {
    v: SYNC_VERSION,
    tables: { profile, cards, reviewLogs, lessonProgress, customTerms, dailyStats, achievements },
    deleted,
  };
}

/** valida la forma general de un snapshot recibido (sin validar cada fila a fondo) */
export function isSnapshot(raw: unknown): raw is SyncSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<SyncSnapshot>;
  if (typeof s.v !== 'number' || !Array.isArray(s.deleted) || !s.tables || typeof s.tables !== 'object') return false;
  if (!s.deleted.every((d) => typeof d === 'string')) return false;
  return SYNC_TABLES.every((t) => {
    const rows = (s.tables as unknown as Record<string, unknown>)[t];
    return Array.isArray(rows) && rows.every((r) => r !== null && typeof r === 'object');
  });
}

// ---------- código de sincronización ----------

/** sin 0/O ni 1/I para que no haya confusiones al copiarlo a mano */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SYNC_CODE_RE = /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/;

/** 20 caracteres aleatorios (100 bits) en grupos de 4: ABCD-EFGH-JKLM-NPQR-STUV */
export function generateSyncCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(20);
  const chars = [...bytes].map((b) => ALPHABET[b % 32]);
  return [0, 4, 8, 12, 16].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

/** acepta minúsculas, espacios y guiones de más; devuelve null si no es válido */
export function normalizeSyncCode(input: string): string | null {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 20) return null;
  const code = [0, 4, 8, 12, 16].map((i) => clean.slice(i, i + 4)).join('-');
  return SYNC_CODE_RE.test(code) ? code : null;
}
