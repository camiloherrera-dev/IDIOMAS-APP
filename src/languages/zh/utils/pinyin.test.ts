import { describe, expect, it } from 'vitest';
import { applyTone, numberedToMarked, toneless, toneOf } from './pinyin';

describe('pinyin', () => {
  it('convierte números a marcas', () => {
    expect(numberedToMarked('ni3 hao3')).toBe('nǐ hǎo');
    expect(numberedToMarked('xie4 xie5')).toBe('xiè xie');
    expect(numberedToMarked('lv4')).toBe('lǜ');
    expect(numberedToMarked('nu:3')).toBe('nǚ');
  });
  it('detecta el tono de una sílaba', () => {
    expect(toneOf('mā')).toBe(1);
    expect(toneOf('má')).toBe(2);
    expect(toneOf('mǎ')).toBe(3);
    expect(toneOf('mà')).toBe(4);
    expect(toneOf('ma')).toBe(5);
  });
  it('quita y aplica tonos según la regla de colocación', () => {
    expect(toneless('hǎo')).toBe('hao');
    expect(applyTone('hao', 3)).toBe('hǎo');
    expect(applyTone('dou', 1)).toBe('dōu');
    expect(applyTone('gui', 4)).toBe('guì');
    expect(applyTone('liu', 2)).toBe('liú');
    expect(applyTone('lü', 4)).toBe('lǜ');
    expect(applyTone('ma', 5)).toBe('ma');
  });
});
