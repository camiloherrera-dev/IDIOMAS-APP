import { db, type DailyStatRow, type LingoDB } from '@/db';

export const XP = {
  exerciseCorrect: 10,
  exercisePartial: 7,
  lessonComplete: 15,
  perfectBonus: 10,
  comboEvery: 5,
  comboBonus: 5,
} as const;

/** YYYY-MM-DD en hora local */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** lunes de la semana de `date` como clave, para el congelador semanal */
function weekKey(date: Date): string {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return dayKey(d);
}

export interface Activity {
  xp: number;
  ms: number;
  reviews: number;
  answered: number;
  correct: number;
}

export async function recordActivity(langId: string, delta: Partial<Activity>, now = new Date(), database: LingoDB = db) {
  const date = dayKey(now);
  const key = `${date}:${langId}`;
  const current: DailyStatRow = (await database.dailyStats.get(key)) ?? {
    key,
    date,
    langId,
    xp: 0,
    ms: 0,
    reviews: 0,
    answered: 0,
    correct: 0,
  };
  await database.dailyStats.put({
    ...current,
    xp: current.xp + (delta.xp ?? 0),
    ms: current.ms + (delta.ms ?? 0),
    reviews: current.reviews + (delta.reviews ?? 0),
    answered: current.answered + (delta.answered ?? 0),
    correct: current.correct + (delta.correct ?? 0),
  });
}

export interface StreakInfo {
  current: number;
  best: number;
  activeToday: boolean;
  /** días cubiertos por el congelador en la racha actual */
  frozenDays: string[];
}

/**
 * Racha diaria con un "congelador" por semana: un único día sin actividad
 * dentro de una semana no rompe la racha si esa semana aún no usó su congelador.
 * Hoy sin actividad no rompe la racha (el día aún no termina).
 */
export function computeStreak(activeDays: Iterable<string>, today = new Date()): StreakInfo {
  const set = new Set(activeDays);
  const activeToday = set.has(dayKey(today));

  const walk = (from: Date, collectFrozen: boolean) => {
    let count = 0;
    const usedWeeks = new Set<string>();
    const frozen: string[] = [];
    let cursor = from;
    for (;;) {
      const key = dayKey(cursor);
      if (set.has(key)) {
        count++;
      } else {
        const prev = dayKey(addDays(cursor, -1));
        const wk = weekKey(cursor);
        // congelar solo un hueco de un día, con actividad a ambos lados
        if (count > 0 && set.has(prev) && !usedWeeks.has(wk)) {
          usedWeeks.add(wk);
          if (collectFrozen) frozen.push(key);
        } else break;
      }
      cursor = addDays(cursor, -1);
    }
    return { count, frozen };
  };

  const start = activeToday ? today : addDays(today, -1);
  const { count: current, frozen } = walk(start, true);

  let best = current;
  const sorted = [...set].sort();
  for (const day of sorted) {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (set.has(dayKey(addDays(date, 1)))) continue; // solo evaluar finales de racha
    best = Math.max(best, walk(date, false).count);
  }

  return { current, best, activeToday, frozenDays: frozen };
}

export async function getStreak(now = new Date(), database: LingoDB = db): Promise<StreakInfo> {
  const rows = await database.dailyStats.toArray();
  return computeStreak(
    rows.filter((r) => r.xp > 0).map((r) => r.date),
    now,
  );
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-lesson', title: 'Primer paso', description: 'Completa tu primera lección.' },
  { id: 'words-50', title: '50 palabras', description: 'Ten 50 palabras en tu mazo.' },
  { id: 'words-100', title: '100 palabras', description: 'Ten 100 palabras en tu mazo.' },
  { id: 'streak-7', title: 'Una semana', description: 'Mantén una racha de 7 días.' },
  { id: 'streak-30', title: 'Un mes', description: 'Mantén una racha de 30 días.' },
  { id: 'unit-complete', title: 'Unidad cerrada', description: 'Completa todas las lecciones de una unidad.' },
  { id: 'reviews-500', title: 'Constancia', description: 'Haz 500 repasos.' },
  { id: 'polyglot', title: 'Dos frentes', description: 'Completa una lección en dos idiomas.' },
];

/** evalúa y guarda logros nuevos; devuelve los recién desbloqueados */
export async function evaluateAchievements(
  unitsByLang: Record<string, { lessons: { id: string }[] }[]>,
  now = new Date(),
  database: LingoDB = db,
): Promise<AchievementDef[]> {
  const [unlocked, progress, cardCount, logCount, streak] = await Promise.all([
    database.achievements.toArray(),
    database.lessonProgress.toArray(),
    database.cards.count(),
    database.reviewLogs.count(),
    getStreak(now, database),
  ]);
  const have = new Set(unlocked.map((a) => a.id));
  const done = new Set(progress.map((p) => p.lessonId));
  const langsWithLesson = new Set(progress.map((p) => p.langId));
  const unitDone = Object.values(unitsByLang).some((units) =>
    units.some((u) => u.lessons.length > 0 && u.lessons.every((l) => done.has(l.id))),
  );

  const checks: Record<string, boolean> = {
    'first-lesson': progress.length > 0,
    'words-50': cardCount >= 50,
    'words-100': cardCount >= 100,
    'streak-7': streak.current >= 7,
    'streak-30': streak.current >= 30,
    'unit-complete': unitDone,
    'reviews-500': logCount >= 500,
    polyglot: langsWithLesson.size >= 2,
  };

  const fresh = ACHIEVEMENTS.filter((a) => checks[a.id] && !have.has(a.id));
  if (fresh.length) await database.achievements.bulkPut(fresh.map((a) => ({ id: a.id, unlockedAt: now.getTime() })));
  return fresh;
}
