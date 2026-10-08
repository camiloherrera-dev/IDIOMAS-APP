import { z } from 'zod';

export const PT_PERSONS = ['eu', 'você', 'ele/ela', 'nós', 'vocês', 'eles/elas'] as const;
export const PT_TENSES = ['presente', 'preterito-perfeito', 'preterito-imperfeito', 'futuro'] as const;

export const ptConjugateSchema = z.object({
  type: z.literal('pt-conjugate'),
  verb: z.string().min(1),
  verbMeaning: z.string().optional(),
  person: z.enum(PT_PERSONS),
  tense: z.enum(PT_TENSES),
  answer: z.string().min(1),
  /** frase de contexto con hueco "___", opcional */
  sentence: z.string().optional(),
});

export type PtConjugateData = z.infer<typeof ptConjugateSchema>;

export const exerciseSchemas = { 'pt-conjugate': ptConjugateSchema };
