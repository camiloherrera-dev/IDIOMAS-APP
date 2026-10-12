import { z } from 'zod';

export const DE_ARTICLES = ['der', 'die', 'das'] as const;

/** elegir el artículo de un sustantivo (der / die / das) */
export const deArticleSchema = z.object({
  type: z.literal('de-article'),
  /** sustantivo sin artículo, con mayúscula: "Tisch" */
  noun: z.string().min(1),
  meaning: z.string().min(1),
  article: z.enum(DE_ARTICLES),
  /** plural con artículo, para mostrar tras corregir: "die Tische" */
  plural: z.string().optional(),
  /** pista corta para recordar el género */
  tip: z.string().optional(),
});

/**
 * Completar el hueco de una frase. Con `options` se elige entre botones
 * (terminaciones, artículos, preposiciones); sin `options` se escribe.
 */
export const deGapSchema = z.object({
  type: z.literal('de-gap'),
  /** instrucción corta: "Completa con el artículo en acusativo" */
  question: z.string().optional(),
  /** frase con un único hueco "___" */
  sentence: z.string().regex(/^[^_]*___[^_]*$/, 'la frase debe tener exactamente un hueco ___'),
  translation: z.string().optional(),
  /** respuestas válidas para el hueco; la primera es la que se muestra */
  answers: z.array(z.string().min(1)).min(1),
  options: z.array(z.string().min(1)).min(2).max(6).optional(),
  hint: z.string().optional(),
  /** explicación que se muestra tras corregir */
  explanation: z.string().optional(),
});

export type DeArticleData = z.infer<typeof deArticleSchema>;
export type DeGapData = z.infer<typeof deGapSchema>;

export const exerciseSchemas = { 'de-article': deArticleSchema, 'de-gap': deGapSchema };
