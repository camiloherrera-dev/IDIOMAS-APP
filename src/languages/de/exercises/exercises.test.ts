import { describe, expect, it } from 'vitest';
import type { LanguagePack } from '@/core/types';
import { normalizeGerman } from '../utils/normalize';
import { checkArticle } from './Article';
import { checkGap } from './Gap';
import type { DeArticleData, DeGapData } from './schemas';

const lang = {
  answerCheck: { diacritics: 'lenient', typoTolerance: true },
  normalizeAnswer: normalizeGerman,
} as unknown as LanguagePack;

describe('de-article', () => {
  const tisch: DeArticleData = {
    type: 'de-article',
    noun: 'Tisch',
    meaning: 'mesa',
    article: 'der',
    plural: 'die Tische',
    tip: 'los muebles suelen ser masculinos.',
  };
  it('acierta y falla según el artículo', () => {
    expect(checkArticle(tisch, 'der').correct).toBe(true);
    expect(checkArticle(tisch, 'das').correct).toBe(false);
    expect(checkArticle(tisch, null).correct).toBe(false);
  });
  it('solución y feedback con plural y pista', () => {
    const r = checkArticle(tisch, 'die');
    expect(r.solution).toBe('der Tisch');
    expect(r.feedback).toBe('Plural: die Tische. Pista: los muebles suelen ser masculinos.');
    expect(checkArticle({ ...tisch, plural: undefined, tip: undefined }, 'der').feedback).toBeUndefined();
  });
});

describe('de-gap', () => {
  const written: DeGapData = {
    type: 'de-gap',
    sentence: 'Ich gehe über die ___.',
    answers: ['Straße'],
    explanation: 'Straße es femenino.',
  };
  it('texto libre: ß = ss y mayúsculas indiferentes', () => {
    expect(checkGap(written, 'Straße', { lang }).correct).toBe(true);
    expect(checkGap(written, 'strasse', { lang }).correct).toBe(true);
    expect(checkGap(written, 'Strase', { lang }).correct).toBe(false);
  });
  it('diéresis olvidada cuenta como casi correcta', () => {
    const r = checkGap({ ...written, answers: ['schön'] }, 'schon', { lang });
    expect(r.correct).toBe(true);
    expect(r.partial).toBe(true);
    expect(r.feedback).toContain('Straße es femenino.');
  });
  it('añade la explicación al feedback', () => {
    expect(checkGap(written, 'Weg', { lang }).feedback).toBe('Straße es femenino.');
  });
  it('con opciones: correcta si la opción está entre las respuestas', () => {
    const choice: DeGapData = {
      type: 'de-gap',
      sentence: 'Ich sehe ___ Mann.',
      answers: ['den'],
      options: ['der', 'den', 'dem'],
    };
    expect(checkGap(choice, 'den', { lang })).toEqual({ correct: true, solution: 'den' });
    expect(checkGap(choice, 'dem', { lang }).correct).toBe(false);
    expect(checkGap({ ...choice, answers: ['den', 'einen'] }, 'einen', { lang }).correct).toBe(true);
  });
});
