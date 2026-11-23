import { toast } from 'sonner';
import { evaluateAchievements, recordActivity, XP } from '@/core/gamification';
import { addKnownTerms, addTermsToDeck } from '@/core/srs';
import type { LanguageContent, Lesson } from '@/core/types';
import { db } from '@/db';
import { languages } from '@/languages';
import { useContentStore } from '@/stores/content';
import type { SessionSummary } from './SessionPlayer';

export interface CompletionResult {
  xp: number;
  newWords: number;
}

function unitsByLang(): Record<string, LanguageContent['units']> {
  const byLang = useContentStore.getState().byLang;
  return Object.fromEntries(
    languages.flatMap((l) => {
      const e = byLang[l.id];
      return e?.status === 'ready' ? [[l.id, e.content.units]] : [];
    }),
  );
}

async function announceAchievements() {
  const fresh = await evaluateAchievements(unitsByLang());
  for (const a of fresh) toast.success(`Logro: ${a.title}`, { description: a.description });
}

export async function completeLesson(
  langId: string,
  lesson: Lesson,
  summary: SessionSummary,
  legacy?: Record<string, string>,
): Promise<CompletionResult> {
  const score = summary.answered ? summary.correctFirstTry / summary.answered : 1;
  const perfect = summary.answered > 0 && summary.correctFirstTry === summary.answered;
  const xp = summary.xp + XP.lessonComplete + (perfect ? XP.perfectBonus : 0);

  const prev = await db.lessonProgress.get(lesson.id);
  await db.lessonProgress.put({
    lessonId: lesson.id,
    langId,
    status: 'completed',
    bestScore: Math.max(prev?.bestScore ?? 0, score),
    completedAt: Date.now(),
  });
  const newWords = await addTermsToDeck(langId, lesson.vocab, new Date(), db, legacy);
  await recordActivity(langId, { xp, ms: summary.ms, answered: summary.answered, correct: summary.correctFirstTry });
  await announceAchievements();
  return { xp, newWords };
}

export async function completePractice(langId: string, summary: SessionSummary): Promise<CompletionResult> {
  await recordActivity(langId, { xp: summary.xp, ms: summary.ms, answered: summary.answered, correct: summary.correctFirstTry });
  await announceAchievements();
  return { xp: summary.xp, newWords: 0 };
}

export async function afterReviewSession() {
  await announceAchievements();
}

/**
 * Prueba de nivel aprobada: marca completas todas las lecciones del nivel y mete sus
 * palabras al mazo como ya sabidas (se comprueban poco a poco en las semanas siguientes).
 */
export async function completeLevelTest(langId: string, content: LanguageContent, level: string, summary: SessionSummary) {
  const lessons = content.units.filter((u) => u.level === level).flatMap((u) => u.lessons);
  const now = Date.now();
  const done = new Set((await db.lessonProgress.where('langId').equals(langId).toArray()).map((p) => p.lessonId));
  await db.lessonProgress.bulkPut(
    lessons
      .filter((l) => !done.has(l.id))
      .map((l, i) => ({ lessonId: l.id, langId, status: 'completed' as const, bestScore: 0, completedAt: now + i })),
  );
  const words = await addKnownTerms(langId, [...new Set(lessons.flatMap((l) => l.vocab))], new Date(), db, content.legacy);
  await recordActivity(langId, { xp: summary.xp, ms: summary.ms, answered: summary.answered, correct: summary.correctFirstTry });
  await announceAchievements();
  return { lessons: lessons.length, words };
}
