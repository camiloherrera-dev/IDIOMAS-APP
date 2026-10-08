import { beforeEach, describe, expect, it } from 'vitest';
import { LingoDB } from '@/db';
import { exportData, importData, wipeData } from '@/db/backup';
import { addTermsToDeck, buildReviewQueue, cardId, gradeCard, Rating, State } from './index';

let db: LingoDB;
let n = 0;
beforeEach(() => {
  db = new LingoDB(`test-${n++}`);
});

describe('SRS', () => {
  it('agrega términos sin duplicar', async () => {
    expect(await addTermsToDeck('pt', ['a', 'b'], new Date(), db)).toBe(2);
    expect(await addTermsToDeck('pt', ['b', 'c'], new Date(), db)).toBe(1);
    expect(await db.cards.count()).toBe(3);
  });

  it('las tarjetas nuevas respetan el límite diario', async () => {
    await addTermsToDeck('pt', ['a', 'b', 'c', 'd'], new Date(), db);
    const q = await buildReviewQueue('pt', { reviewCap: 50, newPerDay: 2, newSeenToday: 0 }, new Date(), db);
    expect(q).toHaveLength(2);
    expect(q.every((c) => c.state === State.New)).toBe(true);
  });

  it('calificar programa la tarjeta, registra el log y suma XP', async () => {
    const now = new Date(2026, 9, 8, 10);
    await addTermsToDeck('pt', ['a'], now, db);
    const card = await gradeCard(cardId('pt', 'a'), Rating.Good, 4000, now, db);
    expect(card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(await db.reviewLogs.count()).toBe(1);
    const stats = await db.dailyStats.toArray();
    expect(stats[0]).toMatchObject({ reviews: 1, correct: 1 });
    expect(stats[0].xp).toBeGreaterThan(0);
  });

  it('las tarjetas no vencidas no entran en la cola', async () => {
    const now = new Date(2026, 9, 8, 10);
    await addTermsToDeck('pt', ['a'], now, db);
    await gradeCard(cardId('pt', 'a'), Rating.Easy, 1000, now, db);
    const q = await buildReviewQueue('pt', { reviewCap: 50, newPerDay: 10, newSeenToday: 0 }, now, db);
    expect(q).toHaveLength(0);
  });

  it('la cola separa idiomas', async () => {
    await addTermsToDeck('pt', ['a'], new Date(), db);
    await addTermsToDeck('zh', ['x', 'y'], new Date(), db);
    const q = await buildReviewQueue('zh', { reviewCap: 50, newPerDay: 10, newSeenToday: 0 }, new Date(), db);
    expect(q.map((c) => c.langId)).toEqual(['zh', 'zh']);
  });
});

describe('respaldo', () => {
  it('exporta e importa todo', async () => {
    await addTermsToDeck('pt', ['a', 'b'], new Date(), db);
    await db.profile.put({
      id: 'me',
      name: 'Camilo',
      activeLang: 'pt',
      langs: ['pt'],
      dailyGoalXp: 30,
      newPerDay: 8,
      reviewCap: 50,
      theme: 'system',
      voiceRate: 0.9,
      sounds: true,
      hideReading: false,
      onboarded: true,
      createdAt: 1,
    });
    const backup = JSON.parse(JSON.stringify(await exportData(db)));
    await wipeData(db);
    expect(await db.cards.count()).toBe(0);
    expect(await importData(backup, db)).toEqual({ cards: 2 });
    expect((await db.profile.get('me'))?.name).toBe('Camilo');
  });

  it('rechaza archivos que no son respaldos', async () => {
    await expect(importData({ foo: 1 }, db)).rejects.toThrow(/respaldo válido/);
  });
});
