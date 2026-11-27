import { describe, expect, it } from 'vitest';
import { composeSchema } from '../schema';
import { checkCompose, countHan } from './Compose';

const data = composeSchema.parse({
  type: 'compose',
  prompt: 'Presenta a tu familia',
  must: ['家', '工作'],
  minChars: 10,
  model: '我家有三口人。爸爸在公司工作。',
});

describe('escritura de textos', () => {
  it('cuenta solo los caracteres chinos', () => {
    expect(countHan('我家，有 3 口人 ok。')).toBe(5);
  });

  it('acepta un texto con las palabras pedidas y el mínimo de caracteres', () => {
    const r = checkCompose(data, { text: '我家有四口人，妈妈在医院工作。' });
    expect(r).toMatchObject({ correct: true });
    expect(r.partial).toBeUndefined();
  });

  it('dice qué palabra falta y cuántos caracteres lleva', () => {
    const r = checkCompose(data, { text: '我有爸爸。' });
    expect(r.correct).toBe(false);
    expect(r.feedback).toContain('«家»');
    expect(r.feedback).toContain('4 de 10');
  });

  it('da por casi bueno un texto al que le falta una sola palabra', () => {
    const r = checkCompose(data, { text: '我家有四口人，我们都很高兴。' });
    expect(r).toMatchObject({ correct: true, partial: true });
    expect(r.feedback).toContain('«工作»');
  });

  it('a mano: no se puede comprobar, se compara con el modelo', () => {
    expect(checkCompose(data, { hand: true })).toMatchObject({ correct: true });
  });

  it('sin respuesta no es correcto', () => {
    expect(checkCompose(data, null).correct).toBe(false);
  });

  it('por palabras: cuenta palabras y acepta formas flexionadas de las palabras pedidas', () => {
    const de = {
      type: 'compose' as const,
      prompt: 'Describe tu día',
      must: ['aufstehen', 'Abend'],
      mustForms: [['stehe', 'steht', 'aufstehen'], ['abend']],
      minWords: 8,
      model: 'Ich stehe um sieben Uhr auf. Am Abend koche ich.',
    };
    expect(checkCompose(de, { text: 'Ich stehe um sechs Uhr auf und am Abend lese ich.' }).correct).toBe(true);
    const short = checkCompose(de, { text: 'Ich stehe auf.' });
    expect(short.correct).toBe(false);
    expect(short.feedback).toContain('palabras');
    expect(checkCompose(de, { text: 'Ich gehe um sechs Uhr und dann lese ich viel.' }).feedback).toContain('aufstehen');
  });
});
