import { shuffleArray } from './random';
import type { ExerciseData, LanguageContent, LanguagePack, Lesson, Term } from '../types';

export type SessionItem = { kind: 'intro'; key: string; term: Term } | { kind: 'exercise'; key: string; data: ExerciseData };

export interface LessonRef {
  lesson: Lesson;
  unitIndex: number;
  lessonIndex: number;
  /** posición global en la ruta (0-based) */
  order: number;
}

export function flattenLessons(content: LanguageContent): LessonRef[] {
  const out: LessonRef[] = [];
  content.units.forEach((u, unitIndex) =>
    u.lessons.forEach((lesson, lessonIndex) => out.push({ lesson, unitIndex, lessonIndex, order: out.length })),
  );
  return out;
}

/** la siguiente lección sin completar (o undefined si se terminó la ruta) */
export function nextLesson(content: LanguageContent, completed: Set<string>): LessonRef | undefined {
  return flattenLessons(content).find((r) => !completed.has(r.lesson.id));
}

/** una lección está desbloqueada si la anterior en la ruta está completada */
export function isUnlocked(ref: LessonRef, all: LessonRef[], completed: Set<string>): boolean {
  if (ref.order === 0) return true;
  return completed.has(all[ref.order - 1].lesson.id);
}

export function termMap(content: LanguageContent): Map<string, Term> {
  return new Map(content.vocab.map((t) => [t.id, t]));
}

/** baraja las opciones de los ejercicios de elección para que la posición no dé pistas */
export function shuffleChoices(data: ExerciseData, rand: () => number = Math.random): ExerciseData {
  if ((data.type !== 'multiple-choice' && data.type !== 'listen-choose') || !Array.isArray(data.options)) return data;
  const options = data.options as string[];
  const correct = options[data.answer as number];
  const shuffled = shuffleArray(options, rand);
  return { ...data, options: shuffled, answer: shuffled.indexOf(correct) };
}

/** lección = presentación de palabras nuevas + ejercicios en el orden del autor */
export function buildLessonSession(lesson: Lesson, content: LanguageContent, opts: { introduce: boolean }): SessionItem[] {
  const terms = termMap(content);
  const intros: SessionItem[] = opts.introduce
    ? lesson.vocab.flatMap((id) => {
        const term = terms.get(id);
        return term ? [{ kind: 'intro' as const, key: `intro-${id}`, term }] : [];
      })
    : [];
  const exercises: SessionItem[] = lesson.exercises.map((data, i) => ({
    kind: 'exercise',
    key: `${lesson.id}-${i}`,
    data: shuffleChoices(data),
  }));
  return [...intros, ...exercises];
}

const meaningOf = (t: Term) => t.meaning.es;

/**
 * Práctica generada a partir de palabras ya aprendidas: mezcla reconocer,
 * escuchar, escribir y emparejar. Usa solo ejercicios genéricos del núcleo.
 */
export function buildPracticeSession(
  learned: Term[],
  lang: LanguagePack,
  count = 10,
  rand: () => number = Math.random,
): SessionItem[] {
  if (learned.length < 4) return [];
  const pool = shuffleArray(learned, rand);
  const items: SessionItem[] = [];
  const distractors = (target: Term, n: number) =>
    shuffleArray(
      learned.filter((t) => t.id !== target.id && meaningOf(t) !== meaningOf(target)),
      rand,
    ).slice(0, n);

  const withAnswer = (correct: string, wrong: string[]) => {
    const options = shuffleArray([correct, ...wrong], rand);
    return { options, answer: options.indexOf(correct) };
  };

  for (let i = 0; items.length < count && i < pool.length * 2; i++) {
    const t = pool[i % pool.length];
    const kind = items.length % 5;
    const key = `practice-${items.length}-${t.id}`;

    if (kind === 4 && learned.length >= 4) {
      const group = shuffleArray(learned, rand)
        .filter((x, idx, arr) => arr.findIndex((y) => meaningOf(y) === meaningOf(x)) === idx)
        .slice(0, 4);
      if (group.length >= 3) {
        items.push({ kind: 'exercise', key, data: { type: 'match-pairs', pairs: group.map((g) => [g.term, meaningOf(g)]) } });
        continue;
      }
    }
    if (kind === 0 || kind === 4) {
      const { options, answer } = withAnswer(meaningOf(t), distractors(t, 3).map(meaningOf));
      items.push({
        kind: 'exercise',
        key,
        data: {
          type: 'multiple-choice',
          question: '¿Qué significa?',
          prompt: t.term,
          promptReading: t.reading,
          speakPrompt: true,
          options,
          answer,
        },
      });
    } else if (kind === 1) {
      const { options, answer } = withAnswer(meaningOf(t), distractors(t, 2).map(meaningOf));
      items.push({
        kind: 'exercise',
        key,
        data: { type: 'listen-choose', question: 'Escucha y elige el significado', audioText: t.term, options, answer },
      });
    } else if (kind === 2) {
      const { options, answer } = withAnswer(
        t.term,
        distractors(t, 3).map((d) => d.term),
      );
      items.push({
        kind: 'exercise',
        key,
        data: { type: 'multiple-choice', question: '¿Cómo se dice?', prompt: meaningOf(t), options, answer },
      });
    } else {
      const answers = [t.term, ...(t.reading && lang.features.romanization ? [t.reading] : [])];
      items.push({
        kind: 'exercise',
        key,
        data: {
          type: 'translate-write',
          prompt: meaningOf(t),
          answers,
          direction: 'to-target',
          hint: lang.features.romanization === 'pinyin' ? 'Hanzi o pinyin con números (ni3 hao3)' : undefined,
        },
      });
    }
  }
  return items;
}
