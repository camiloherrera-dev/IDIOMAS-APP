import { describe, expect, it } from 'vitest';
import { seeded } from '@/core/lessons/random';
import { counted, numberDrill, toChinese } from './numbers';

describe('números en chino', () => {
  it('convierte con 零, 十 y 两 como se dicen', () => {
    expect(toChinese(10)).toBe('十');
    expect(toChinese(12)).toBe('十二');
    expect(toChinese(20)).toBe('二十');
    expect(toChinese(105)).toBe('一百零五');
    expect(toChinese(110)).toBe('一百一十');
    expect(toChinese(200)).toBe('两百');
    expect(toChinese(2050)).toBe('两千零五十');
    expect(toChinese(3500)).toBe('三千五百');
    expect(toChinese(20000)).toBe('两万');
    expect(toChinese(30500)).toBe('三万零五百');
    expect(counted(2)).toBe('两');
  });

  it('cada ejercicio tiene una sola respuesta correcta y opciones distintas', () => {
    const rand = seeded(7);
    for (let i = 0; i < 300; i++) {
      const d = numberDrill(rand);
      expect(d.options.length).toBeGreaterThanOrEqual(3);
      expect(new Set(d.options).size).toBe(d.options.length);
      expect(d.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('差五分九点 son las 8:55', () => {
    const rand = seeded(1);
    for (let i = 0; i < 200; i++) {
      const d = numberDrill(rand, 'hora');
      if (d.audio === '现在差五分九点。') expect(d.options[d.answer]).toBe('8:55');
    }
  });
});
