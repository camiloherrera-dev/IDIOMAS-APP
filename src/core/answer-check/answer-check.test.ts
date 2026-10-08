import { describe, expect, it } from 'vitest';
import { normalizeZhAnswer } from '@/languages/zh/utils/pinyin';
import { checkText, levenshtein, normalize, stripDiacritics } from './index';

const PT = { diacritics: 'lenient', typoTolerance: true } as const;
const ZH = { diacritics: 'strict', diacriticsFeedback: 'tonos', typoTolerance: false } as const;

describe('normalize', () => {
  it('ignora mayúsculas, puntuación y espacios extra', () => {
    expect(normalize('  Muito  obrigado!! ')).toBe('muito obrigado');
    expect(normalize('¿Você é daqui?')).toBe('você é daqui');
  });
  it('quita diacríticos', () => {
    expect(stripDiacritics('não, você, ação')).toBe('nao, voce, acao');
  });
});

describe('levenshtein', () => {
  it('cuenta ediciones', () => {
    expect(levenshtein('obrigado', 'obrigado')).toBe(0);
    expect(levenshtein('obrigado', 'obrigada')).toBe(1);
    expect(levenshtein('casa', 'caso')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('checkText (portugués)', () => {
  it('acepta cualquiera de las respuestas válidas', () => {
    expect(checkText('meu nome é Camilo', ['Eu me chamo Camilo', 'Meu nome é Camilo']).correct).toBe(true);
  });
  it('una tilde faltante es "casi correcto"', () => {
    expect(checkText('voce e daqui', ['Você é daqui?'], PT)).toMatchObject({ correct: true, partial: true });
  });
  it('tolera una errata en palabras largas', () => {
    expect(checkText('obrigadoo', ['obrigado'], PT)).toMatchObject({ correct: true, partial: true });
  });
  it('no tolera erratas en palabras cortas', () => {
    expect(checkText('oii', ['oi'], PT).correct).toBe(false);
  });
  it('una respuesta vacía es incorrecta y muestra la solución', () => {
    expect(checkText('   ', ['sou'], PT)).toEqual({ correct: false, solution: 'sou' });
  });
});

describe('checkText (chino)', () => {
  it('acepta pinyin con números', () => {
    expect(checkText('ni3 hao3', ['你好', 'nǐ hǎo'], ZH, normalizeZhAnswer).correct).toBe(true);
  });
  it('acepta pinyin con números sin espacios', () => {
    expect(checkText('ni3hao3', ['你好', 'nǐ hǎo'], ZH, normalizeZhAnswer).correct).toBe(true);
  });
  it('acepta pinyin con mayúsculas', () => {
    expect(checkText('Zhōngguó', ['中国', 'zhōng guó'], ZH, normalizeZhAnswer).correct).toBe(true);
  });
  it('acepta hanzi exacto', () => {
    expect(checkText('你好', ['你好', 'nǐ hǎo'], ZH, normalizeZhAnswer).correct).toBe(true);
  });
  it('tono equivocado es error con pista', () => {
    expect(checkText('ni2 hao3', ['nǐ hǎo'], ZH, normalizeZhAnswer)).toMatchObject({ correct: false, feedback: 'tonos' });
  });
  it('pinyin sin tonos es error con pista', () => {
    expect(checkText('ni hao', ['nǐ hǎo'], ZH, normalizeZhAnswer)).toMatchObject({ correct: false, feedback: 'tonos' });
  });
});
