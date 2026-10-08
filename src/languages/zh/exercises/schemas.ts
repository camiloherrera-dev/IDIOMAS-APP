import { z } from 'zod';

export const toneSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const zhToneSchema = z
  .object({
    type: z.literal('zh-tone'),
    hanzi: z.string().min(1),
    /** sílabas en pinyin con marcas, una por carácter */
    syllables: z.array(z.string().min(1)).min(1),
    /** tono de cada sílaba (5 = neutro), en forma de cita (sin sandhi) */
    tones: z.array(toneSchema).min(1),
    meaning: z.string().optional(),
  })
  .refine((d) => d.syllables.length === d.tones.length, { message: 'syllables y tones deben tener la misma longitud' });

export type ZhToneData = z.infer<typeof zhToneSchema>;

export const exerciseSchemas = { 'zh-tone': zhToneSchema };
