import { describe, expect, it } from 'vitest';
import { conjugate, conjugateAll } from './conjugate';

describe('conjugador portugués', () => {
  it('regulares en presente', () => {
    expect(conjugateAll('falar', 'presente')).toEqual(['falo', 'fala', 'falamos', 'falam']);
    expect(conjugateAll('comer', 'presente')).toEqual(['como', 'come', 'comemos', 'comem']);
    expect(conjugateAll('partir', 'presente')).toEqual(['parto', 'parte', 'partimos', 'partem']);
  });
  it('pretérito perfeito con cambios ortográficos', () => {
    expect(conjugate('ficar', 'eu', 'preterito-perfeito')).toBe('fiquei');
    expect(conjugate('chegar', 'eu', 'preterito-perfeito')).toBe('cheguei');
    expect(conjugate('começar', 'eu', 'preterito-perfeito')).toBe('comecei');
    expect(conjugate('falar', 'ele/ela', 'preterito-perfeito')).toBe('falou');
    expect(conjugate('comer', 'eles/elas', 'preterito-perfeito')).toBe('comeram');
  });
  it('presente con -cer pasa a -ço', () => {
    expect(conjugate('conhecer', 'eu', 'presente')).toBe('conheço');
  });
  it('imperfeito y futuro', () => {
    expect(conjugate('falar', 'nós', 'preterito-imperfeito')).toBe('falávamos');
    expect(conjugate('abrir', 'nós', 'preterito-imperfeito')).toBe('abríamos');
    expect(conjugate('falar', 'eles/elas', 'futuro')).toBe('falarão');
  });
  it('irregulares', () => {
    expect(conjugate('ser', 'eu', 'presente')).toBe('sou');
    expect(conjugate('estar', 'vocês', 'presente')).toBe('estão');
    expect(conjugate('ir', 'nós', 'presente')).toBe('vamos');
    expect(conjugate('ter', 'eles/elas', 'presente')).toBe('têm');
    expect(conjugate('fazer', 'eu', 'futuro')).toBe('farei');
    expect(conjugate('ser', 'nós', 'futuro')).toBe('seremos');
    expect(conjugate('ir', 'você', 'preterito-imperfeito')).toBe('ia');
  });
  it('rechaza lo que no es verbo', () => {
    expect(conjugateAll('casa', 'presente')).toBeNull();
  });
});
