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

export const lessonSchema = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  title: z.string().min(1),
  level: z.string().min(1),
  /** id de una guía de gramática que sirve de introducción */
  intro: z.string().optional(),
  vocab: z.array(z.string()).default([]),
  exercises: z.array(exerciseBaseSchema).min(1),
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
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().nonnegative(),
});

export const listenChooseSchema = z.object({
  type: z.literal('listen-choose'),
  question: z.string().optional(),
  audioText: z.string().min(1),
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

export const coreExerciseSchemas = {
  'multiple-choice': multipleChoiceSchema,
  'listen-choose': listenChooseSchema,
  'translate-write': translateWriteSchema,
  'word-order': wordOrderSchema,
  'match-pairs': matchPairsSchema,
} as const;

export type Example = z.infer<typeof exampleSchema>;
export type Term = z.infer<typeof termSchema>;
export type ExerciseData = z.infer<typeof exerciseBaseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type MultipleChoiceData = z.infer<typeof multipleChoiceSchema>;
export type ListenChooseData = z.infer<typeof listenChooseSchema>;
export type TranslateWriteData = z.infer<typeof translateWriteSchema>;
export type WordOrderData = z.infer<typeof wordOrderSchema>;
export type MatchPairsData = z.infer<typeof matchPairsSchema>;
