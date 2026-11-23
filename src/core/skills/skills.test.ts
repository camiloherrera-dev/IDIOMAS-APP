import { beforeEach, describe, expect, it } from 'vitest';
import { LingoDB } from '@/db';
import { flagSkill, MASTERED_STREAK, recordSkill, WEAK_AFTER, weakSkills } from './index';

let db: LingoDB;
let n = 0;
beforeEach(() => {
  db = new LingoDB(`skills-${n++}`);
});

describe('puntos débiles', () => {
  it('un punto se vuelve débil tras varios fallos', async () => {
    for (let i = 0; i < WEAK_AFTER - 1; i++) await recordSkill('zh', 'ba-oracion', false, new Date(), db);
    expect(await weakSkills('zh', db)).toHaveLength(0);
    await recordSkill('zh', 'ba-oracion', false, new Date(), db);
    expect((await weakSkills('zh', db)).map((s) => s.skill)).toEqual(['ba-oracion']);
  });

  it('deja de ser débil con una racha de aciertos', async () => {
    await flagSkill('zh', 'numeros-escucha', db);
    expect(await weakSkills('zh', db)).toHaveLength(1);
    for (let i = 0; i < MASTERED_STREAK; i++) await recordSkill('zh', 'numeros-escucha', true, new Date(), db);
    expect(await weakSkills('zh', db)).toHaveLength(0);
  });

  it('ordena por fallos y separa idiomas', async () => {
    await flagSkill('zh', 'a', db);
    for (let i = 0; i < 6; i++) await recordSkill('zh', 'b', false, new Date(), db);
    await flagSkill('pt', 'c', db);
    expect((await weakSkills('zh', db)).map((s) => s.skill)).toEqual(['b', 'a']);
  });
});
