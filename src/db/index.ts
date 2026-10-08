import Dexie, { type EntityTable } from 'dexie';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Profile {
  id: 'me';
  name: string;
  activeLang: string;
  langs: string[];
  dailyGoalXp: number;
  newPerDay: number;
  reviewCap: number;
  theme: ThemePref;
  voiceRate: number;
  sounds: boolean;
  /** ocultar pinyin/lectura en tarjetas a medida que se avanza */
  hideReading: boolean;
  onboarded: boolean;
  createdAt: number;
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

export interface CardRow extends StoredFsrs {
  /** `${langId}:${termId}` */
  id: string;
  langId: string;
  termId: string;
  createdAt: number;
}

export interface ReviewLogRow {
  id?: number;
  cardId: string;
  langId: string;
  rating: number;
  reviewedAt: number;
  elapsedMs: number;
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

export class LingoDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  cards!: EntityTable<CardRow, 'id'>;
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>;
  lessonProgress!: EntityTable<LessonProgressRow, 'lessonId'>;
  customTerms!: EntityTable<CustomTermRow, 'id'>;
  dailyStats!: EntityTable<DailyStatRow, 'key'>;
  achievements!: EntityTable<AchievementRow, 'id'>;

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
  reviewCap: 50,
  theme: 'system',
  voiceRate: 0.9,
  sounds: true,
  hideReading: false,
  onboarded: false,
  createdAt: 0,
};

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? { ...DEFAULT_PROFILE, createdAt: Date.now() };
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const current = await getProfile();
  await db.profile.put({ ...current, ...patch });
}

/** pide al navegador que no borre IndexedDB (Safari lo hace con sitios poco usados) */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
