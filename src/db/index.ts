import Dexie, { type EntityTable } from 'dexie';
import { stampTable } from './stamps';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Profile {
  id: 'me';
  name: string;
  activeLang: string;
  langs: string[];
  dailyGoalXp: number;
  newPerDay: number;
  /** las palabras de cada lección se repasan todas desde el día siguiente (sin límite diario); por defecto sí */
  nextDayNew?: boolean;
  reviewCap: number;
  theme: ThemePref;
  voiceRate: number;
  sounds: boolean;
  /** ocultar pinyin/lectura en tarjetas a medida que se avanza */
  hideReading: boolean;
  /** mostrar el pinyin en las frases de las lecciones y en las lecturas; por defecto sí */
  showPinyin?: boolean;
  onboarded: boolean;
  /** tipos de tarjeta activos además de reconocer: escuchar y producir escribiendo */
  cardKinds?: CardKind[];
  /** retención deseada del repaso espaciado (0.8 a 0.95) */
  retention?: number;
  /** meta por idioma: terminar un nivel antes de una fecha (YYYY-MM-DD) */
  goals?: Record<string, { level: string; date: string }>;
  createdAt: number;
  /** última edición (para resolver conflictos al sincronizar) */
  updatedAt?: number;
}

/** Estado FSRS serializado (fechas como epoch ms) */
export interface StoredFsrs {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
}

/** recog: ver la palabra y recordar el significado; listen: solo se oye; produce: del significado a la palabra, escribiendo */
export type CardKind = 'recog' | 'listen' | 'produce';

export interface CardRow extends StoredFsrs {
  /** `${langId}:${termId}` para reconocer; `${langId}:${termId}#listen|#produce` para las hermanas */
  id: string;
  langId: string;
  termId: string;
  createdAt: number;
  /** sin valor = recog */
  kind?: CardKind;
  /** fuera de la cola hasta que se reactive (a mano o por fallarla demasiado) */
  suspended?: boolean;
  /** se suspendió sola por fallarla muchas veces */
  leech?: boolean;
  /** truco propio para recordarla */
  note?: string;
}

export interface ReviewLogRow {
  id?: number;
  cardId: string;
  langId: string;
  rating: number;
  reviewedAt: number;
  elapsedMs: number;
  /** estado de la tarjeta antes del repaso (para ajustar FSRS a la memoria del usuario más adelante) */
  state?: number;
  stability?: number;
  difficulty?: number;
  scheduled_days?: number;
  elapsed_days?: number;
}

/** aciertos y fallos por punto practicado (p. ej. una estructura gramatical); solo local */
export interface SkillRow {
  /** `${langId}:${skill}` */
  key: string;
  langId: string;
  skill: string;
  /** fallos acumulados desde la última vez que se dominó */
  wrong: number;
  /** aciertos seguidos */
  streak: number;
  total: number;
  lastWrongAt?: number;
}

export interface LessonProgressRow {
  lessonId: string;
  langId: string;
  status: 'completed';
  bestScore: number;
  completedAt: number;
}

export interface CustomTermRow {
  id: string;
  langId: string;
  term: string;
  reading?: string;
  meaning: string;
  notes?: string;
  tags: string[];
  createdAt: number;
}

export interface DailyStatRow {
  /** `${date}:${langId}` */
  key: string;
  /** YYYY-MM-DD en hora local */
  date: string;
  langId: string;
  xp: number;
  ms: number;
  reviews: number;
  answered: number;
  correct: number;
}

export interface AchievementRow {
  id: string;
  unlockedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface TombstoneRow {
  key: string;
  tbl: 'cards' | 'customTerms';
  id: string;
  _ts?: number;
}

/** tablas que se sincronizan con la cuenta (llevan _ts) más la de borrados */
export const STAMPED_TABLES = [
  'profile',
  'cards',
  'reviewLogs',
  'lessonProgress',
  'customTerms',
  'dailyStats',
  'achievements',
  'skills',
  'tombstones',
] as const;

export class LingoDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  cards!: EntityTable<CardRow, 'id'>;
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>;
  lessonProgress!: EntityTable<LessonProgressRow, 'lessonId'>;
  customTerms!: EntityTable<CustomTermRow, 'id'>;
  dailyStats!: EntityTable<DailyStatRow, 'key'>;
  achievements!: EntityTable<AchievementRow, 'id'>;
  skills!: EntityTable<SkillRow, 'key'>;
  /** datos del dispositivo: dueño, cursores de sincronización, id del dispositivo */
  meta!: EntityTable<MetaRow, 'key'>;
  /** borrados que hay que avisar a la cuenta ("cards:<id>", "customTerms:<id>") */
  tombstones!: EntityTable<TombstoneRow, 'key'>;

  constructor(name = 'lingo-lab') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      cards: 'id, langId, [langId+due], termId',
      reviewLogs: '++id, cardId, langId, reviewedAt',
      lessonProgress: 'lessonId, langId',
      customTerms: 'id, langId, createdAt',
      dailyStats: 'key, date, langId',
      achievements: 'id',
    });
    this.version(2).stores({ skills: 'key, langId' });
    // v3: sincronización por filas con la cuenta (marca _ts en cada tabla sincronizada)
    this.version(3)
      .stores({
        profile: 'id, _ts',
        cards: 'id, langId, [langId+due], termId, _ts',
        reviewLogs: '++id, cardId, langId, reviewedAt, [cardId+reviewedAt], _ts',
        lessonProgress: 'lessonId, langId, _ts',
        customTerms: 'id, langId, createdAt, _ts',
        dailyStats: 'key, date, langId, _ts',
        achievements: 'id, _ts',
        skills: 'key, langId, _ts',
        meta: 'key',
        tombstones: 'key, _ts',
      })
      .upgrade(async (tx) => {
        // lo que ya había queda pendiente de subir, con marcas únicas y antiguas
        let n = 0;
        for (const name of STAMPED_TABLES) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: Record<string, unknown>) => {
              row._ts = ++n;
            });
        }
      });
    for (const name of STAMPED_TABLES) stampTable(this.table(name) as never);
  }
}

export const db = new LingoDB();

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  name: '',
  activeLang: 'pt',
  langs: ['pt'],
  dailyGoalXp: 30,
  newPerDay: 8,
  nextDayNew: true,
  reviewCap: 50,
  theme: 'system',
  voiceRate: 0.9,
  sounds: true,
  hideReading: false,
  onboarded: false,
  cardKinds: ['listen', 'produce'],
  retention: 0.9,
  createdAt: 0,
};

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? { ...DEFAULT_PROFILE, createdAt: Date.now() };
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const current = await getProfile();
  await db.profile.put({ ...current, ...patch, updatedAt: Date.now() });
}

/** pide al navegador que no borre IndexedDB (Safari lo hace con sitios poco usados) */
export async function requestPersistence(): Promise<boolean> {
  try {
    // (cast: en el chequeo de tipos de la API, `navigator` es el de Node)
    const storage = (
      globalThis.navigator as { storage?: { persist(): Promise<boolean>; persisted(): Promise<boolean> } } | undefined
    )?.storage;
    if (!storage?.persist) return false;
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
