import { z } from 'zod';

/**
 * Esquemas del contenido. Este archivo no importa React para que
 * `scripts/validate-content.ts` pueda usarlo desde Node.
 */

export const exampleSchema = z.object({
  text: z.string().min(1),
  reading: z.string().optional(),
  translation: z.string().min(1),
});

export const termSchema = z.object({
  id: z.string().regex(/^[a-z]{2,3}(-[a-z0-9]+)+$/, 'id con formato <lang>-<nivel>-<nnnn>'),
  term: z.string().min(1),
  reading: z.string().optional(),
  traditional: z.string().optional(),
  meaning: z.object({ es: z.string().min(1) }).catchall(z.string()),
  pos: z.string().optional(),
  examples: z.array(exampleSchema).default([]),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  level: z.string().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

/** Cualquier ejercicio: el tipo concreto se valida con el esquema de su plugin. */
export const exerciseBaseSchema = z.looseObject({ type: z.string().min(1) });

/**
 * Frase en contexto. `text` lleva las palabras separadas por espacios (también en
 * chino, para poder ordenarlas) y entre [corchetes] las palabras foco de la lección:
 * "我 [已经] 吃饭 了。". Los ejercicios se generan al vuelo a partir de ella.
 */
export const sentenceSchema = z.object({
  text: z.string().min(1),
  tr: z.string().min(1),
  reading: z.string().optional(),
});

export const lessonSchema = z
  .object({
    id: z.string().min(1),
    unit: z.string().min(1),
    title: z.string().min(1),
    level: z.string().min(1),
    /** vocab: palabras nuevas; grammar: un punto gramatical; listening: escucha; reading: lectura con preguntas; review: repaso de la unidad */
    kind: z.enum(['vocab', 'grammar', 'listening', 'reading', 'review']).default('vocab'),
    /** id de una guía de gramática que sirve de introducción */
    intro: z.string().optional(),
    vocab: z.array(z.string()).default([]),
    /** ejercicios escritos a mano, en el orden del autor */
    exercises: z.array(exerciseBaseSchema).default([]),
    /** si true, el motor genera al vuelo los ejercicios de vocabulario (distintos cada vez) */
    drill: z.boolean().default(false),
    /** frases en contexto de las que se generan ejercicios */
    sentences: z.array(sentenceSchema).default([]),
    /** opciones extra para completar huecos (p. ej. otros conectores) */
    choices: z.array(z.string()).default([]),
    /** punto que practica la lección; alimenta el seguimiento de errores */
    skill: z.string().optional(),
  })
  .refine((l) => l.exercises.length > 0 || l.drill || l.sentences.length > 0 || l.kind === 'review', {
    message: 'la lección no tiene ejercicios, frases ni drill',
  });

export const unitSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  level: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
});

export const guideFrontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  level: z.string().optional(),
  order: z.coerce.number().optional(),
});

// ---------- Ejercicios genéricos del núcleo ----------

export const multipleChoiceSchema = z.object({
  type: z.literal('multiple-choice'),
  question: z.string().optional(),
  prompt: z.string().min(1),
  promptReading: z.string().optional(),
  /** si true, el prompt está en el idioma meta y se puede escuchar */
  speakPrompt: z.boolean().optional(),
  /** el prompt está en el idioma meta pero no se lee en voz alta (p. ej. una frase con hueco) */
  targetPrompt: z.boolean().optional(),
  /** pista bajo el prompt (p. ej. la traducción de la frase con hueco) */
  context: z.string().optional(),
  /** frase completa en el idioma meta que se muestra, con audio, al comprobar */
  reveal: z.string().optional(),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().nonnegative(),
});

export const listenChooseSchema = z.object({
  type: z.literal('listen-choose'),
  question: z.string().optional(),
  audioText: z.string().min(1),
  /** si true, las opciones están en el idioma meta (escuchar y elegir lo que se dijo) */
  targetOptions: z.boolean().optional(),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().nonnegative(),
});

export const translateWriteSchema = z.object({
  type: z.literal('translate-write'),
  prompt: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1),
  /** to-target: escribir en el idioma que se estudia; to-native: escribir en español */
  direction: z.enum(['to-target', 'to-native']).default('to-target'),
  hint: z.string().optional(),
});

export const wordOrderSchema = z.object({
  type: z.literal('word-order'),
  prompt: z.string().min(1),
  /** si está, la frase se escucha (dictado por orden) en lugar de leerse la traducción */
  audioText: z.string().optional(),
  /** palabras en el orden correcto */
  words: z.array(z.string().min(1)).min(2),
  distractors: z.array(z.string().min(1)).default([]),
});

export const matchPairsSchema = z.object({
  type: z.literal('match-pairs'),
  pairs: z
    .array(z.tuple([z.string().min(1), z.string().min(1)]))
    .min(3)
    .max(6),
});

/** diálogo que solo se escucha, con una pregunta al final (formato de los exámenes de escucha) */
export const dialogueSchema = z.object({
  type: z.literal('dialogue'),
  /** F y M alternan dos voces; N es el narrador */
  turns: z.array(z.object({ s: z.enum(['F', 'M', 'N']), text: z.string().min(1) })).min(1),
  /** pregunta en el idioma meta: se oye tras el diálogo */
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int().nonnegative(),
  /** de qué va, en español: se muestra al comprobar */
  tr: z.string().optional(),
});

/**
 * Lectura con una pregunta de comprensión. Varias preguntas sobre el mismo texto son
 * ejercicios seguidos con el mismo `text`. `text` lleva las palabras separadas por
 * espacios y los párrafos por saltos de línea; `py`, el pinyin palabra por palabra.
 */
export const readingSchema = z.object({
  type: z.literal('reading'),
  title: z.string().min(1),
  text: z.string().min(1),
  py: z.string().optional(),
  tr: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int().nonnegative(),
  /** [número de pregunta, total] sobre este texto */
  part: z.tuple([z.number().int(), z.number().int()]).optional(),
  /** límite de tiempo en segundos (desde HSK 3) */
  seconds: z.number().positive().optional(),
});

/** escribir un texto corto con palabras obligatorias y un mínimo de caracteres */
export const composeSchema = z.object({
  type: z.literal('compose'),
  prompt: z.string().min(1),
  must: z.array(z.string().min(1)).default([]),
  minChars: z.number().int().positive(),
  model: z.string().min(1),
  modelTr: z.string().optional(),
});

export const coreExerciseSchemas = {
  reading: readingSchema,
  compose: composeSchema,
  'multiple-choice': multipleChoiceSchema,
  'listen-choose': listenChooseSchema,
  'translate-write': translateWriteSchema,
  'word-order': wordOrderSchema,
  'match-pairs': matchPairsSchema,
  dialogue: dialogueSchema,
} as const;

export type Example = z.infer<typeof exampleSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type Term = z.infer<typeof termSchema>;
export type ExerciseData = z.infer<typeof exerciseBaseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type MultipleChoiceData = z.infer<typeof multipleChoiceSchema>;
export type ListenChooseData = z.infer<typeof listenChooseSchema>;
export type TranslateWriteData = z.infer<typeof translateWriteSchema>;
export type WordOrderData = z.infer<typeof wordOrderSchema>;
export type MatchPairsData = z.infer<typeof matchPairsSchema>;
export type DialogueData = z.infer<typeof dialogueSchema>;
export type ReadingData = z.infer<typeof readingSchema>;
export type ComposeData = z.infer<typeof composeSchema>;
