import { flattenLessons, nextLesson, termMap } from '@/core/lessons';
import { weakSkills } from '@/core/skills';
import { coverageOf, isKnown, kindOf, State, termsInDeck } from '@/core/srs';
import type { LanguageContent, LanguagePack } from '@/core/types';
import { db, type Profile } from '@/db';

/**
 * Resumen del estado de estudio en Markdown, para pegarlo en una conversación con el
 * tutor (Claude): así la sesión parte del nivel, las palabras y los errores reales.
 */
export async function buildTutorContext(lang: LanguagePack, content: LanguageContent, profile: Profile): Promise<string> {
  const terms = termMap(content);
  const [deck, cards, progress, weak, stats] = await Promise.all([
    termsInDeck(lang.id, content.legacy),
    db.cards.where('langId').equals(lang.id).toArray(),
    db.lessonProgress.where('langId').equals(lang.id).toArray(),
    weakSkills(lang.id),
    db.dailyStats.where('langId').equals(lang.id).toArray(),
  ]);
  const completed = new Set(progress.map((p) => p.lessonId));
  const last = progress.reduce<(typeof progress)[number] | undefined>(
    (a, b) => (!a || b.completedAt > a.completedAt ? b : a),
    undefined,
  );
  const next = nextLesson(content, completed, last?.lessonId);
  const all = flattenLessons(content);
  const word = (termId: string) => terms.get(termId)?.term;

  const recog = cards.filter((c) => kindOf(c) === 'recog');
  const learning = recog
    .filter((c) => c.state !== State.New && !isKnown(c) && !c.suspended)
    .sort((a, b) => (b.last_review ?? 0) - (a.last_review ?? 0))
    .slice(0, 80)
    .flatMap((c) => word(c.termId) ?? []);
  const hard = cards
    .filter((c) => c.suspended || c.lapses >= 3)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 25)
    .flatMap((c) => word(c.termId) ?? []);
  const recent = recog
    .filter((c) => c.state !== State.New)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30)
    .flatMap((c) => word(c.termId) ?? []);

  const week = [...stats].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const sum = week.reduce(
    (a, s) => ({
      answered: a.answered + s.answered,
      correct: a.correct + s.correct,
      reviews: a.reviews + s.reviews,
      ms: a.ms + s.ms,
    }),
    {
      answered: 0,
      correct: 0,
      reviews: 0,
      ms: 0,
    },
  );

  const lines: string[] = [];
  lines.push(`# Contexto de estudio: ${lang.name} (${new Date().toLocaleDateString('es')})`);
  lines.push('');
  lines.push(`- Estudiante: ${profile.name || 'sin nombre'}`);
  if (next)
    lines.push(
      `- Lección actual en Lingo Lab: «${next.lesson.title}» (${next.lesson.level}, ${content.units[next.unitIndex].title})`,
    );
  lines.push(`- Lecciones completadas: ${all.filter((r) => completed.has(r.lesson.id)).length} de ${all.length}`);
  const goal = profile.goals?.[lang.id];
  if (goal) lines.push(`- Meta: terminar ${goal.level} antes del ${goal.date}`);
  for (const c of lang.coverage ?? []) {
    const cov = coverageOf(
      content.vocab.filter((t) => t.level === c.level).map((t) => t.id),
      deck,
    );
    if (cov.inDeck) lines.push(`- Vocabulario ${c.label}: ${cov.known} sabidas, ${cov.inDeck} en el mazo, de ${cov.total}`);
  }
  if (sum.answered || sum.reviews)
    lines.push(
      `- Últimos 7 días con actividad: ${Math.round(sum.ms / 60000)} min, ${sum.reviews} repasos, precisión ${
        sum.answered ? Math.round((sum.correct / sum.answered) * 100) : 0
      } %`,
    );
  lines.push('');
  lines.push('## Puntos débiles (errores recurrentes)');
  lines.push(
    weak.length
      ? weak.map((w) => `- ${content.guides.find((g) => g.id === w.skill)?.title ?? w.skill} (${w.wrong} fallos)`).join('\n')
      : '- Sin patrones registrados todavía.',
  );
  lines.push('');
  lines.push('## Palabras nuevas recientes');
  lines.push(recent.join('、') || 'Ninguna.');
  lines.push('');
  lines.push('## Palabras en aprendizaje (úsalas en el calentamiento y los juegos de rol)');
  lines.push(learning.join('、') || 'Ninguna.');
  lines.push('');
  lines.push('## Palabras que más falla');
  lines.push(hard.join('、') || 'Ninguna.');
  return lines.join('\n');
}
