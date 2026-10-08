import { toast } from 'sonner';
import { evaluateAchievements, recordActivity, XP } from '@/core/gamification';
import { addTermsToDeck } from '@/core/srs';
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

export async function completeLesson(langId: string, lesson: Lesson, summary: SessionSummary): Promise<CompletionResult> {
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
  const newWords = await addTermsToDeck(langId, lesson.vocab);
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
