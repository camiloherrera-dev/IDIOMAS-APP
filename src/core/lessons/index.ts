import { shuffleArray } from './random';
import { gapSentence, parseSentence, plainSentence } from './sentences';
import type { ExerciseData, Guide, LanguageContent, LanguagePack, Lesson, Sentence, Term } from '../types';

export type SessionItem =
  | { kind: 'intro'; key: string; term: Term }
  | { kind: 'guide'; key: string; guide: Guide }
  /** portada de una sección (pruebas con formato de examen) */
  | { kind: 'section'; key: string; step: string; title: string; body: string }
  | { kind: 'exercise'; key: string; data: ExerciseData };

export interface LessonRef {
  lesson: Lesson;
  unitIndex: number;
  lessonIndex: number;
  /** posición global en la ruta (0-based) */
  order: number;
}

type Rand = () => number;

const flatCache = new WeakMap<LanguageContent, LessonRef[]>();

export function flattenLessons(content: LanguageContent): LessonRef[] {
  const cached = flatCache.get(content);
  if (cached) return cached;
  const out: LessonRef[] = [];
  content.units.forEach((u, unitIndex) =>
    u.lessons.forEach((lesson, lessonIndex) => out.push({ lesson, unitIndex, lessonIndex, order: out.length })),
  );
  flatCache.set(content, out);
  return out;
}

/**
 * La siguiente lección: la primera sin completar después de la última que se
 * completó (así se puede empezar en un nivel avanzado y seguir desde ahí).
 * Sin `lastCompletedId`, la primera sin completar de toda la ruta.
 */
export function nextLesson(content: LanguageContent, completed: Set<string>, lastCompletedId?: string): LessonRef | undefined {
  const all = flattenLessons(content);
  const last = lastCompletedId ? all.find((r) => r.lesson.id === lastCompletedId) : undefined;
  if (last) {
    const after = all.find((r) => r.order > last.order && !completed.has(r.lesson.id));
    if (after) return after;
  }
  return all.find((r) => !completed.has(r.lesson.id));
}

/** desbloqueada si la anterior está completada o si es la primera de su nivel (se puede entrar a cualquier nivel) */
export function isUnlocked(ref: LessonRef, all: LessonRef[], completed: Set<string>): boolean {
  if (ref.order === 0) return true;
  const prev = all[ref.order - 1];
  return completed.has(prev.lesson.id) || prev.lesson.level !== ref.lesson.level;
}

const termCache = new WeakMap<LanguageContent, Map<string, Term>>();

/** términos por id; incluye los ids antiguos (`content.legacy`) apuntando al término actual */
export function termMap(content: LanguageContent): Map<string, Term> {
  const cached = termCache.get(content);
  if (cached) return cached;
  const map = new Map(content.vocab.map((t) => [t.id, t]));
  for (const [old, current] of Object.entries(content.legacy ?? {})) {
    const t = map.get(current);
    if (t && !map.has(old)) map.set(old, t);
  }
  termCache.set(content, map);
  return map;
}

/** niveles presentes en la ruta, en orden */
export function levelsOf(content: LanguageContent): string[] {
  return [...new Set(content.units.map((u) => u.level))];
}

/** baraja las opciones de los ejercicios de elección para que la posición no dé pistas */
export function shuffleChoices(data: ExerciseData, rand: Rand = Math.random): ExerciseData {
  if (!['multiple-choice', 'listen-choose', 'dialogue', 'reading'].includes(data.type) || !Array.isArray(data.options))
    return data;
  const options = data.options as string[];
  const correct = options[data.answer as number];
  const shuffled = shuffleArray(options, rand);
  return { ...data, options: shuffled, answer: shuffled.indexOf(correct) };
}

// ---------------------------------------------------------------------------
// Generadores de ejercicios
// ---------------------------------------------------------------------------

const meaningOf = (t: Term) => t.meaning.es;

function withAnswer(correct: string, wrong: string[], rand: Rand) {
  const options = shuffleArray([...new Set([correct, ...wrong.filter((w) => w !== correct)])], rand);
  return { options, answer: options.indexOf(correct) };
}

/** distractores: primero de la misma categoría gramatical y luego del resto del pozo */
function pickDistractors(target: Term, pool: Term[], n: number, rand: Rand, by: (t: Term) => string): Term[] {
  const seen = new Set([by(target), meaningOf(target), target.term]);
  const out: Term[] = [];
  const take = (list: Term[]) => {
    for (const t of shuffleArray(list, rand)) {
      if (out.length >= n) return;
      if (t.id === target.id || seen.has(by(t)) || meaningOf(t) === meaningOf(target) || t.term === target.term) continue;
      seen.add(by(t));
      out.push(t);
    }
  };
  take(pool.filter((t) => t.pos && t.pos === target.pos));
  take(pool);
  return out;
}

export type DrillKind = 'meaning' | 'listen' | 'reverse' | 'write' | 'lang';

/** un ejercicio de vocabulario para `t`; `pool` aporta los distractores */
export function drillFor(
  kind: DrillKind,
  t: Term,
  pool: Term[],
  lang: LanguagePack,
  rand: Rand = Math.random,
): ExerciseData | undefined {
  if (kind === 'meaning') {
    const d = pickDistractors(t, pool, 3, rand, meaningOf);
    if (d.length < 2) return undefined;
    return {
      type: 'multiple-choice',
      question: '¿Qué significa?',
      prompt: t.term,
      promptReading: t.reading,
      speakPrompt: true,
      ...withAnswer(meaningOf(t), d.map(meaningOf), rand),
    };
  }
  if (kind === 'listen') {
    const d = pickDistractors(t, pool, 3, rand, meaningOf);
    if (d.length < 2) return undefined;
    return {
      type: 'listen-choose',
      question: 'Escucha y elige el significado',
      audioText: t.term,
      ...withAnswer(meaningOf(t), d.map(meaningOf), rand),
    };
  }
  if (kind === 'reverse') {
    const d = pickDistractors(t, pool, 3, rand, (x) => x.term);
    if (d.length < 2) return undefined;
    return {
      type: 'multiple-choice',
      question: '¿Cómo se dice?',
      prompt: meaningOf(t),
      ...withAnswer(
        t.term,
        d.map((x) => x.term),
        rand,
      ),
    };
  }
  if (kind === 'write') {
    const answers = [t.term, ...(t.reading && lang.features.romanization ? [t.reading] : [])];
    return {
      type: 'translate-write',
      prompt: meaningOf(t),
      answers,
      direction: 'to-target',
      hint: lang.features.romanization === 'pinyin' ? 'Hanzi o pinyin con números (ni3 hao3)' : undefined,
    };
  }
  const own = lang.drills?.(t) ?? [];
  return own.length ? own[Math.floor(rand() * own.length)] : undefined;
}

function matchPairs(terms: Term[], rand: Rand): ExerciseData | undefined {
  const unique = shuffleArray(terms, rand).filter(
    (x, i, arr) => arr.findIndex((y) => meaningOf(y) === meaningOf(x) || y.term === x.term) === i,
  );
  const group = unique.slice(0, 5);
  if (group.length < 3) return undefined;
  return { type: 'match-pairs', pairs: group.map((g) => [g.term, meaningOf(g)]) };
}

export type SentenceKind = 'cloze' | 'meaning' | 'listen' | 'order' | 'dictation';

interface SentenceCtx {
  lang: LanguagePack;
  /** otras frases (para distractores de traducción) */
  others: Sentence[];
  /** palabras candidatas para rellenar huecos */
  fillers: string[];
  showReading: boolean;
  rand: Rand;
}

/** un ejercicio a partir de una frase en contexto */
export function sentenceExercise(kind: SentenceKind, s: Sentence, ctx: SentenceCtx): ExerciseData | undefined {
  const { lang, rand } = ctx;
  const tokens = parseSentence(s);
  const plain = plainSentence(s, lang);

  if (kind === 'cloze') {
    const focus = tokens.map((t, i) => ({ t, i })).filter((x) => x.t.focus && x.t.word);
    if (!focus.length) return undefined;
    const pick = focus[Math.floor(rand() * focus.length)];
    const inSentence = new Set(tokens.map((t) => t.word));
    const wrong = shuffleArray(
      [...new Set(ctx.fillers)].filter((w) => w !== pick.t.word && !inSentence.has(w)),
      rand,
    ).slice(0, 3);
    if (wrong.length < 2) return undefined;
    return {
      type: 'multiple-choice',
      question: 'Completa la frase',
      prompt: gapSentence(tokens, pick.i, lang),
      targetPrompt: true,
      context: s.tr,
      reveal: plain,
      ...withAnswer(pick.t.word, wrong, rand),
    };
  }

  if (kind === 'meaning' || kind === 'listen') {
    const wrong = shuffleArray(
      [...new Set(ctx.others.map((o) => o.tr))].filter((tr) => tr !== s.tr),
      rand,
    ).slice(0, 2);
    if (wrong.length < 2) return undefined;
    const choice = withAnswer(s.tr, wrong, rand);
    return kind === 'meaning'
      ? {
          type: 'multiple-choice',
          question: '¿Qué significa?',
          prompt: plain,
          promptReading: ctx.showReading ? s.reading : undefined,
          speakPrompt: true,
          ...choice,
        }
      : { type: 'listen-choose', question: 'Escucha y elige el significado', audioText: plain, ...choice };
  }

  const words = tokens.map((t) => t.word).filter(Boolean);
  if (words.length < 3 || words.length > 9) return undefined;
  if (kind === 'order') return { type: 'word-order', prompt: s.tr, words, distractors: [] };
  return { type: 'word-order', prompt: s.tr, audioText: plain, words, distractors: [] };
}

interface ContentIndex {
  byLevel: Map<string, Term[]>;
  sentencesByLevel: Map<string, Sentence[]>;
}

const indexCache = new WeakMap<LanguageContent, ContentIndex>();

function indexOf(content: LanguageContent): ContentIndex {
  const cached = indexCache.get(content);
  if (cached) return cached;
  const terms = termMap(content);
  const byLevel = new Map<string, Term[]>();
  const sentencesByLevel = new Map<string, Sentence[]>();
  const seen = new Set<string>();
  for (const { lesson } of flattenLessons(content)) {
    const list = byLevel.get(lesson.level) ?? [];
    for (const id of lesson.vocab) {
      const t = terms.get(id);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }
    byLevel.set(lesson.level, list);
    sentencesByLevel.set(lesson.level, [...(sentencesByLevel.get(lesson.level) ?? []), ...lesson.sentences]);
  }
  const index = { byLevel, sentencesByLevel };
  indexCache.set(content, index);
  return index;
}

/** palabras que se enseñan en un nivel (según las lecciones de la ruta) */
export function termsOfLevel(content: LanguageContent, level: string): Term[] {
  return indexOf(content).byLevel.get(level) ?? [];
}

const READING_LEVELS = 2;

/** en los dos primeros niveles de un idioma con romanización se muestra la lectura de las frases */
function showsReading(content: LanguageContent, level: string, lang: LanguagePack): boolean {
  if (!lang.features.romanization) return false;
  const i = levelsOf(content).indexOf(level);
  return i >= 0 && i < READING_LEVELS;
}

function tag(data: ExerciseData | undefined, skill: string | undefined): ExerciseData[] {
  if (!data) return [];
  return [skill ? { ...data, skill } : data];
}

function sentenceItems(
  sentences: Sentence[],
  kinds: SentenceKind[][],
  ctx: SentenceCtx,
  skill: string | undefined,
  keyPrefix: string,
  limit: number,
): SessionItem[] {
  const out: SessionItem[] = [];
  const order = shuffleArray(
    sentences.map((s, i) => ({ s, i })),
    ctx.rand,
  );
  kinds.forEach((round, r) => {
    for (const { s, i } of order) {
      if (out.length >= limit) return;
      // prueba los tipos de la ronda en orden rotado hasta que uno sea posible
      const start = (i + r) % round.length;
      for (let k = 0; k < round.length; k++) {
        const [data] = tag(sentenceExercise(round[(start + k) % round.length], s, ctx), skill);
        if (data) {
          out.push({ kind: 'exercise', key: `${keyPrefix}-s${i}-r${r}`, data });
          break;
        }
      }
    }
  });
  return out;
}

export interface LessonSessionOptions {
  introduce: boolean;
  lang: LanguagePack;
  rand?: Rand;
}

/**
 * Sesión de una lección.
 * - Lecciones escritas a mano: presentación de palabras + ejercicios en el orden del autor.
 * - Lecciones `drill`: las palabras se presentan de 4 en 4, cada grupo con su ejercicio
 *   de reconocimiento; luego práctica más exigente (escuchar, producir, tonos) y frases.
 * - Gramática y escucha: ejercicios generados de las frases y los escritos a mano.
 * - Repaso: mezcla de las palabras y frases de las lecciones anteriores de la unidad.
 */
export function buildLessonSession(lesson: Lesson, content: LanguageContent, opts: LessonSessionOptions): SessionItem[] {
  const { lang } = opts;
  const rand = opts.rand ?? Math.random;
  const terms = termMap(content);
  const index = indexOf(content);
  const levelTerms = index.byLevel.get(lesson.level) ?? [];
  const levelSentences = index.sentencesByLevel.get(lesson.level) ?? [];
  const showReading = showsReading(content, lesson.level, lang);
  const unit = content.units.find((u) => u.id === lesson.unit);
  const unitLessons = unit?.lessons ?? [lesson];
  const own = lesson.vocab.flatMap((id) => terms.get(id) ?? []);
  const items: SessionItem[] = [];
  const exercise = (key: string, data: ExerciseData | undefined) => {
    if (data) items.push({ kind: 'exercise', key, data });
  };

  // la explicación abre las lecciones de gramática
  if (lesson.kind === 'grammar' && lesson.intro) {
    const guide = content.guides.find((g) => g.id === lesson.intro);
    if (guide) items.push({ kind: 'guide', key: `guide-${guide.id}`, guide });
  }

  if (lesson.kind === 'review') {
    const before = unitLessons.slice(0, Math.max(0, unitLessons.indexOf(lesson)));
    const words = [
      ...new Map(before.flatMap((l) => l.vocab.flatMap((id) => terms.get(id) ?? [])).map((t) => [t.id, t])).values(),
    ];
    const sentences = before.flatMap((l) => l.sentences);
    const pool = words.length >= 6 ? words : levelTerms;
    const kinds: DrillKind[] = ['meaning', 'listen', 'reverse', 'lang', 'write', 'listen', 'reverse', 'meaning'];
    shuffleArray(words, rand)
      .slice(0, 10)
      .forEach((t, i) =>
        exercise(
          `${lesson.id}-w${i}`,
          drillFor(kinds[i % kinds.length], t, pool, lang, rand) ?? drillFor('meaning', t, levelTerms, lang, rand),
        ),
      );
    exercise(`${lesson.id}-pairs`, matchPairs(words, rand));
    const ctx: SentenceCtx = {
      lang,
      others: sentences.length >= 3 ? sentences : levelSentences,
      fillers: words.map((w) => w.term),
      showReading,
      rand,
    };
    items.push(...sentenceItems(sentences, [['order', 'listen', 'cloze', 'meaning', 'dictation']], ctx, undefined, lesson.id, 6));
    lesson.exercises.forEach((data, i) => exercise(`${lesson.id}-x${i}`, shuffleChoices(data, rand)));
    return items;
  }

  const unitTerms = unitLessons.flatMap((l) => l.vocab.flatMap((id) => terms.get(id) ?? []));
  const pool = [...new Map([...own, ...unitTerms, ...levelTerms].map((t) => [t.id, t])).values()];

  if (lesson.drill && own.length) {
    // 1) presentar de 4 en 4 y reconocer enseguida
    for (let i = 0; i < own.length; i += 4) {
      const group = own.slice(i, i + 4);
      if (opts.introduce) group.forEach((term) => items.push({ kind: 'intro', key: `intro-${term.id}`, term }));
      shuffleArray(group, rand).forEach((t) => exercise(`${lesson.id}-m-${t.id}`, drillFor('meaning', t, pool, lang, rand)));
    }
    // 2) práctica más exigente: escuchar, producir y lo propio del idioma
    const second: DrillKind[] = ['listen', 'reverse', 'lang', 'reverse', 'listen', 'write', 'lang', 'reverse'];
    shuffleArray(own, rand).forEach((t, i) =>
      exercise(
        `${lesson.id}-d-${t.id}`,
        drillFor(second[i % second.length], t, pool, lang, rand) ?? drillFor('reverse', t, pool, lang, rand),
      ),
    );
    exercise(`${lesson.id}-pairs`, matchPairs(own, rand));
  } else if (opts.introduce) {
    own.forEach((term) => items.push({ kind: 'intro', key: `intro-${term.id}`, term }));
  }

  if (lesson.sentences.length) {
    const others =
      lesson.sentences.length >= 3 ? [...lesson.sentences, ...unitLessons.flatMap((l) => l.sentences)] : levelSentences;
    const focusWords = lesson.sentences.flatMap((s) =>
      parseSentence(s)
        .filter((t) => t.focus)
        .map((t) => t.word),
    );
    // con `choices` (idiomas con flexión) los huecos se rellenan con formas reales, no con el lema de la tarjeta
    const fillers = [
      ...lesson.choices,
      ...focusWords,
      ...(lesson.kind === 'vocab' && !lesson.choices.length ? own.map((t) => t.term) : []),
    ];
    const ctx: SentenceCtx = { lang, others, fillers, showReading, rand };
    const rounds: SentenceKind[][] =
      lesson.kind === 'grammar'
        ? [['cloze'], ['order', 'meaning', 'dictation', 'listen']]
        : [
            ['cloze', 'meaning'],
            ['order', 'listen', 'dictation'],
          ];
    const limit = lesson.kind === 'grammar' ? 14 : 8;
    items.push(...sentenceItems(lesson.sentences, rounds, ctx, lesson.skill, lesson.id, limit));
  }

  lesson.exercises.forEach((data, i) =>
    exercise(`${lesson.id}-x${i}`, shuffleChoices(lesson.skill && !data.skill ? { ...data, skill: lesson.skill } : data, rand)),
  );
  return items;
}

/**
 * Práctica generada a partir de palabras ya aprendidas: mezcla reconocer,
 * escuchar, escribir y emparejar.
 */
export function buildPracticeSession(learned: Term[], lang: LanguagePack, count = 10, rand: Rand = Math.random): SessionItem[] {
  if (learned.length < 4) return [];
  const pool = shuffleArray(learned, rand);
  const items: SessionItem[] = [];
  const kinds: DrillKind[] = ['meaning', 'listen', 'reverse', 'write'];
  for (let i = 0; items.length < count && i < pool.length * 2; i++) {
    const t = pool[i % pool.length];
    const key = `practice-${items.length}-${t.id}`;
    if (items.length % 5 === 4) {
      const pairs = matchPairs(learned, rand);
      if (pairs) {
        items.push({ kind: 'exercise', key, data: pairs });
        continue;
      }
    }
    const data = drillFor(kinds[items.length % 5 === 4 ? 0 : items.length % 5], t, learned, lang, rand);
    if (data) items.push({ kind: 'exercise', key, data });
  }
  return items;
}

export interface ReadingSet {
  /** id de la lección de lectura */
  id: string;
  title: string;
  level: string;
  /** caracteres del texto (sin espacios ni puntuación) */
  chars: number;
  exercises: ExerciseData[];
}

/** lecturas del curso (todas o las de un nivel), en el orden de la ruta */
export function readingsOf(content: LanguageContent, level?: string): ReadingSet[] {
  return flattenLessons(content)
    .map((r) => r.lesson)
    .filter((l) => l.kind === 'reading' && (!level || l.level === level))
    .map((l) => {
      const text = String(l.exercises.find((e) => e.type === 'reading')?.text ?? '');
      return {
        id: l.id,
        title: l.title.replace(/^Lectura:\s*/, ''),
        level: l.level,
        chars: text.replace(/[\p{P}\p{S}\s]/gu, '').length,
        exercises: l.exercises,
      };
    });
}

/** sesión de una lectura suelta: sus preguntas y, si tiene, la tarea de escritura */
export function buildReadingSession(set: ReadingSet, rand: Rand = Math.random): SessionItem[] {
  return set.exercises.map((data, i) => ({ kind: 'exercise', key: `${set.id}-x${i}`, data: shuffleChoices(data, rand) }));
}

/**
 * Prueba de nivel con la forma del examen HSK, en corto: escucha, lectura y escritura,
 * en ese orden y con una portada por parte. Unas 20 preguntas (el examen real tiene 40-100).
 */
export function buildLevelTest(
  content: LanguageContent,
  level: string,
  lang: LanguagePack,
  rand: Rand = Math.random,
): SessionItem[] {
  const index = indexOf(content);
  const words = index.byLevel.get(level) ?? [];
  const sentences = index.sentencesByLevel.get(level) ?? [];
  if (words.length < 8) return [];
  const lessons = flattenLessons(content)
    .map((r) => r.lesson)
    .filter((l) => l.level === level);
  const key = `test-${level}`;
  const ctx: SentenceCtx = { lang, others: sentences, fillers: words.map((w) => w.term), showReading: false, rand };
  const pool = shuffleArray(words, rand);
  let w = 0;
  const drills = (kinds: DrillKind[], prefix: string): SessionItem[] =>
    kinds.flatMap((k, i) => {
      const t = pool[w++ % pool.length];
      const data = drillFor(k, t, words, lang, rand) ?? drillFor('meaning', t, words, lang, rand);
      return data ? [{ kind: 'exercise' as const, key: `${key}-${prefix}${i}`, data }] : [];
    });
  const fromSentences = (kinds: SentenceKind[], n: number, prefix: string) =>
    sentences.length >= 6 ? sentenceItems(shuffleArray(sentences, rand), [kinds], ctx, undefined, `${key}-${prefix}`, n) : [];
  const section = (n: number, title: string, body: string): SessionItem => ({
    kind: 'section',
    key: `${key}-sec${n}`,
    step: `Parte ${n} de 3`,
    title,
    body,
  });

  // 1) escucha: frases y diálogos, como en el examen
  const dialogues = shuffleArray(
    lessons.filter((l) => l.kind === 'listening').flatMap((l) => l.exercises.filter((e) => e.type === 'dialogue')),
    rand,
  ).slice(0, 3);
  const listening: SessionItem[] = [
    ...fromSentences(['listen'], 4, 'l'),
    ...dialogues.map((data, i) => ({ kind: 'exercise' as const, key: `${key}-d${i}`, data: shuffleChoices(data, rand) })),
  ];
  if (listening.length < 5) listening.push(...drills(Array(5 - listening.length).fill('listen'), 'lw'));

  // 2) lectura: completar frases, vocabulario y un texto con preguntas
  const passage = shuffleArray(readingsOf(content, level), rand)[0];
  const reading: SessionItem[] = [
    ...fromSentences(['cloze'], 4, 'c'),
    ...drills(['meaning', 'meaning'], 'rw'),
    ...(passage
      ? passage.exercises
          .filter((e) => e.type === 'reading')
          .map((data, i) => ({ kind: 'exercise' as const, key: `${key}-p${i}`, data: shuffleChoices(data, rand) }))
      : fromSentences(['meaning'], 2, 'm')),
  ];

  // 3) escritura: ordenar la frase y escribir la palabra
  const writing: SessionItem[] = [...fromSentences(['order'], 4, 'o'), ...drills(['write', 'reverse', 'write'], 'ww')];

  return [
    section(1, 'Escucha', 'Frases y diálogos cortos. Intenta responder con una sola escucha, como en el examen.'),
    ...listening,
    section(2, 'Lectura', 'Completa frases y responde preguntas sobre un texto.'),
    ...reading,
    section(3, 'Escritura', 'Ordena las palabras para formar la frase y escribe la palabra que se pide.'),
    ...writing,
  ];
}

/** lecciones que practican un punto concreto */
export function lessonsForSkill(content: LanguageContent, skill: string): Lesson[] {
  return flattenLessons(content)
    .map((r) => r.lesson)
    .filter((l) => l.skill === skill);
}

/** sesión de refuerzo de un punto débil: frases de todas las lecciones de ese punto */
export function buildSkillSession(
  content: LanguageContent,
  skill: string,
  lang: LanguagePack,
  count = 10,
  rand: Rand = Math.random,
): SessionItem[] {
  const lessons = lessonsForSkill(content, skill);
  if (!lessons.length) return [];
  const sentences = lessons.flatMap((l) => l.sentences);
  const level = lessons[0].level;
  const focusWords = sentences.flatMap((s) =>
    parseSentence(s)
      .filter((t) => t.focus)
      .map((t) => t.word),
  );
  const ctx: SentenceCtx = {
    lang,
    others: sentences.length >= 3 ? sentences : (indexOf(content).sentencesByLevel.get(level) ?? []),
    fillers: [...lessons.flatMap((l) => l.choices), ...focusWords],
    showReading: showsReading(content, level, lang),
    rand,
  };
  const items = sentenceItems(sentences, [['cloze'], ['order', 'dictation', 'meaning']], ctx, skill, `skill-${skill}`, count);
  const manual = shuffleArray(
    lessons.flatMap((l) => l.exercises),
    rand,
  ).slice(0, Math.max(0, count - items.length));
  manual.forEach((data, i) =>
    items.push({ kind: 'exercise', key: `skill-${skill}-x${i}`, data: shuffleChoices({ ...data, skill }, rand) }),
  );
  return shuffleArray(items, rand);
}
