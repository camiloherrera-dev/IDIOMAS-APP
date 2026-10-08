import { describe, expect, it } from 'vitest';
import { CORE_PLUGINS } from '@/core/exercises';
import type { LanguagePack, Term } from '@/core/types';
import { buildPracticeSession, shuffleChoices } from './index';
import { seeded } from './random';

const lang = {
  id: 'pt',
  wordSeparator: ' ',
  features: {},
  answerCheck: { diacritics: 'lenient', typoTolerance: true },
} as unknown as LanguagePack;
const term = (i: number): Term => ({
  id: `pt-a1-${i}`,
  term: `palavra${i}`,
  meaning: { es: `palabra${i}` },
  examples: [],
  tags: [],
});

describe('motor de lecciones', () => {
  it('barajar opciones conserva la respuesta correcta', () => {
    const data = { type: 'multiple-choice', prompt: 'x', options: ['a', 'b', 'c', 'd'], answer: 2 };
    for (let s = 0; s < 20; s++) {
      const out = shuffleChoices(data, seeded(s)) as typeof data;
      expect(out.options[out.answer]).toBe('c');
    }
  });

  it('sin 4 palabras no genera práctica', () => {
    expect(buildPracticeSession([term(1), term(2)], lang)).toEqual([]);
  });

  it('la práctica generada es válida para los esquemas del núcleo', () => {
    const items = buildPracticeSession(
      Array.from({ length: 8 }, (_, i) => term(i)),
      lang,
      10,
      seeded(7),
    );
    expect(items).toHaveLength(10);
    const plugins = new Map(CORE_PLUGINS.map((p) => [p.type, p]));
    for (const item of items) {
      if (item.kind !== 'exercise') continue;
      const plugin = plugins.get(item.data.type);
      expect(plugin, item.data.type).toBeDefined();
      expect(plugin!.schema.safeParse(item.data).success).toBe(true);
    }
    expect(new Set(items.map((i) => (i.kind === 'exercise' ? i.data.type : ''))).size).toBeGreaterThanOrEqual(4);
  });
});
