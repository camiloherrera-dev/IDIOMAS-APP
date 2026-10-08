import { describe, expect, it } from 'vitest';
import { addDays, computeStreak, dayKey } from './index';

// jueves 8 de octubre de 2026, hora local
const today = new Date(2026, 9, 8, 15);
const days = (...offsets: number[]) => offsets.map((o) => dayKey(addDays(today, -o)));

describe('computeStreak', () => {
  it('sin actividad, racha 0', () => {
    expect(computeStreak([], today)).toMatchObject({ current: 0, best: 0, activeToday: false });
  });
  it('cuenta días seguidos incluyendo hoy', () => {
    expect(computeStreak(days(0, 1, 2), today)).toMatchObject({ current: 3, activeToday: true });
  });
  it('hoy sin estudiar aún no rompe la racha', () => {
    expect(computeStreak(days(1, 2, 3), today)).toMatchObject({ current: 3, activeToday: false });
  });
  it('el congelador cubre un día suelto', () => {
    const s = computeStreak(days(0, 2, 3), today);
    expect(s.current).toBe(3);
    expect(s.frozenDays).toEqual(days(1));
  });
  it('dos días seguidos sin estudiar rompen la racha', () => {
    expect(computeStreak(days(0, 3, 4), today).current).toBe(1);
  });
  it('solo un congelador por semana', () => {
    // faltan el miércoles 7 y el lunes 5, ambos en la misma semana
    expect(computeStreak(days(0, 2, 4, 5), today).current).toBe(2);
  });
  it('calcula la mejor racha histórica', () => {
    expect(computeStreak(days(0, 20, 21, 22, 23, 24), today).best).toBe(5);
  });
});
