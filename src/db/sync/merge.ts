/**
 * Fusión de datos entre dispositivos. Este archivo es puro (sin Dexie ni React):
 * lo usan la app y la función serverless `api/sync.ts`.
 *
 * La fusión es conmutativa e idempotente: no importa en qué orden lleguen los
 * cambios de cada dispositivo, el resultado es el mismo.
 */
import type {
  AchievementRow,
  CardRow,
  CustomTermRow,
  DailyStatRow,
  LessonProgressRow,
  Profile,
  ReviewLogRow,
  SkillRow,
} from '../index';

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

/** momento de la última edición local de una fila (lo pone el motor de sincronización) */
const editedAt = (row: object) => (row as { _m?: number })._m ?? 0;

function pickCard(a: CardRow, b: CardRow): CardRow {
  // gana la tarjeta repasada más recientemente; en empate, la de más repasos y luego la editada más tarde
  const ra = a.last_review ?? 0;
  const rb = b.last_review ?? 0;
  if (ra !== rb) return rb > ra ? b : a;
  if (a.reps !== b.reps) return b.reps > a.reps ? b : a;
  if (editedAt(a) !== editedAt(b)) return editedAt(b) > editedAt(a) ? b : a;
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

const pickCustomTerm = (x: CustomTermRow, y: CustomTermRow): CustomTermRow =>
  (editedAt(y) || y.createdAt) > (editedAt(x) || x.createdAt) ? y : x;

const pickAchievement = (x: AchievementRow, y: AchievementRow): AchievementRow => (y.unlockedAt < x.unlockedAt ? y : x);

function pickSkill(a: SkillRow, b: SkillRow): SkillRow {
  // gana la que más práctica registra; en empate, la editada más tarde
  if (a.total !== b.total) return b.total > a.total ? b : a;
  return editedAt(b) > editedAt(a) ? b : a;
}

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
  const customTerms = mergeBy(A.customTerms, B.customTerms, (t) => t.id, pickCustomTerm).filter(
    (t) => !gone.has(`customTerms:${t.id}`),
  );
  const dailyStats = mergeBy(A.dailyStats, B.dailyStats, (s) => s.key, pickStat);
  const achievements = mergeBy(A.achievements, B.achievements, (x) => x.id, pickAchievement);

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

// ---------- sincronización por filas (cuentas) ----------

/** tablas que se sincronizan con la cuenta, en el orden en que se suben */
export const ROW_TABLES = [
  'profile',
  'skills',
  'lessonProgress',
  'achievements',
  'customTerms',
  'dailyStats',
  'cards',
  'reviewLogs',
] as const;
export type RowTable = (typeof ROW_TABLES)[number];

/** una fila tal como viaja entre la app y el servidor */
export interface SyncRow {
  tbl: RowTable;
  id: string;
  data: Record<string, unknown> | null;
  deleted?: boolean;
}

export const isRowTable = (t: unknown): t is RowTable => typeof t === 'string' && (ROW_TABLES as readonly string[]).includes(t);

/** clave estable de una fila en el servidor */
export function rowKey(tbl: RowTable, row: Record<string, unknown>): string {
  switch (tbl) {
    case 'profile':
      return 'me';
    case 'reviewLogs':
      return reviewLogKey(row as unknown as ReviewLogRow);
    case 'lessonProgress':
      return String(row.lessonId);
    case 'dailyStats':
    case 'skills':
      return String(row.key);
    default:
      return String(row.id);
  }
}

/** quita lo que es solo local: el id autoincremental del historial y la marca de cambios pendientes */
export function cleanRow(tbl: RowTable, row: Record<string, unknown>): Record<string, unknown> {
  const { _ts: _drop, ...rest } = row;
  if (tbl === 'reviewLogs') delete rest.id;
  return rest;
}

/** fusiona dos versiones de la misma fila con la regla de su tabla (conmutativa) */
export function mergeRow(tbl: RowTable, a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const m = (() => {
    switch (tbl) {
      case 'profile':
        return pickProfile(a as unknown as Profile, b as unknown as Profile);
      case 'cards':
        return pickCard(a as unknown as CardRow, b as unknown as CardRow);
      case 'reviewLogs':
        return a;
      case 'lessonProgress':
        return pickLesson(a as unknown as LessonProgressRow, b as unknown as LessonProgressRow);
      case 'customTerms':
        return pickCustomTerm(a as unknown as CustomTermRow, b as unknown as CustomTermRow);
      case 'dailyStats':
        return pickStat(a as unknown as DailyStatRow, b as unknown as DailyStatRow);
      case 'achievements':
        return pickAchievement(a as unknown as AchievementRow, b as unknown as AchievementRow);
      case 'skills':
        return pickSkill(a as unknown as SkillRow, b as unknown as SkillRow);
    }
  })() as unknown as Record<string, unknown>;
  // la marca de edición siempre avanza
  const ma = editedAt(a);
  const mb = editedAt(b);
  return ma || mb ? { ...m, _m: Math.max(ma, mb) } : m;
}

/** igualdad profunda que no depende del orden de las claves (Postgres reordena el JSON) */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => sameData(x, bb[i]));
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** convierte una foto completa (código antiguo o respaldo) en filas */
export function snapshotToRows(snap: SyncSnapshot): SyncRow[] {
  const rows: SyncRow[] = [];
  const tables = snap.tables as unknown as Record<string, Record<string, unknown>[] | undefined>;
  for (const tbl of ROW_TABLES) {
    for (const row of tables[tbl] ?? []) {
      const data = cleanRow(tbl, row);
      rows.push({ tbl, id: rowKey(tbl, data), data });
    }
  }
  for (const d of snap.deleted) {
    const [tbl, ...rest] = d.split(':');
    if (isRowTable(tbl)) rows.push({ tbl, id: rest.join(':'), data: null, deleted: true });
  }
  return rows;
}

/** límites de la API de filas */
export const ROW_LIMITS = { batch: 500, pullPage: 1000, idLength: 300, rowBytes: 32_000, bodyBytes: 1_500_000 } as const;

/** valida una fila recibida; devuelve un mensaje si no sirve */
export function rowProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'fila inválida';
  const r = raw as Partial<SyncRow>;
  if (!isRowTable(r.tbl)) return 'tabla desconocida';
  if (typeof r.id !== 'string' || !r.id || r.id.length > ROW_LIMITS.idLength) return 'id inválido';
  if (r.deleted) return r.tbl === 'cards' || r.tbl === 'customTerms' ? null : 'esa tabla no admite borrados';
  if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return 'datos inválidos';
  if (JSON.stringify(r.data).length > ROW_LIMITS.rowBytes) return 'fila demasiado grande';
  if (rowKey(r.tbl, r.data) !== r.id) return 'el id no coincide con los datos';
  return null;
}
