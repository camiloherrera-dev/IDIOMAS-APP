import { useLiveQuery } from 'dexie-react-hooks';
import { dayKey, getStreak } from '@/core/gamification';
import { buildReviewQueue, newSeenToday } from '@/core/srs';
import { db, type Profile } from '@/db';

/** estado reactivo de estudio para un idioma: progreso, repasos, racha y XP de hoy */
export function useStudyState(langId: string | undefined, profile: Profile | undefined) {
  return useLiveQuery(async () => {
    if (!langId || !profile) return undefined;
    const now = new Date();
    const [progress, cards, seen, today, streak] = await Promise.all([
      db.lessonProgress.where('langId').equals(langId).toArray(),
      db.cards.where('langId').equals(langId).toArray(),
      newSeenToday(langId, now),
      db.dailyStats.where('date').equals(dayKey(now)).toArray(),
      getStreak(now),
    ]);
    const queue = await buildReviewQueue(
      langId,
      { reviewCap: profile.reviewCap, newPerDay: profile.newPerDay, nextDayNew: profile.nextDayNew ?? true, seen },
      now,
    );
    const last = progress.reduce<(typeof progress)[number] | undefined>(
      (a, b) => (!a || b.completedAt > a.completedAt ? b : a),
      undefined,
    );
    return {
      completed: new Set(progress.map((p) => p.lessonId)),
      /** última lección completada: la ruta continúa desde ahí */
      lastCompletedId: last?.lessonId,
      /** palabras distintas en el mazo */
      deckSize: new Set(cards.map((c) => c.termId)).size,
      suspended: cards.filter((c) => c.suspended).length,
      dueCount: queue.length,
      todayXp: today.reduce((s, r) => s + r.xp, 0),
      todayXpLang: today.find((r) => r.langId === langId)?.xp ?? 0,
      streak,
    };
  }, [langId, profile?.reviewCap, profile?.newPerDay, profile?.nextDayNew]);
}
