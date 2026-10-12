import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, LingoDB, type CardRow } from '../index';
import { applySnapshot, localSnapshot } from './index';
import { emptySnapshot, generateSyncCode, mergeSnapshots, normalizeSyncCode, SYNC_CODE_RE, type SyncSnapshot } from './merge';

const card = (id: string, patch: Partial<CardRow> = {}): CardRow => ({
  id,
  langId: 'de',
  termId: id.split(':')[1],
  createdAt: 1,
  due: 100,
  stability: 1,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  ...patch,
});

function snap(fill: (s: SyncSnapshot) => void): SyncSnapshot {
  const s = emptySnapshot();
  fill(s);
  return s;
}

describe('mergeSnapshots', () => {
  const a = snap((s) => {
    s.tables.profile = [{ ...DEFAULT_PROFILE, name: 'A', langs: ['pt'], createdAt: 1, updatedAt: 10 }];
    s.tables.cards = [card('de:x', { reps: 2, last_review: 50 }), card('de:y')];
    s.tables.reviewLogs = [{ cardId: 'de:x', langId: 'de', rating: 3, reviewedAt: 50, elapsedMs: 900 }];
    s.tables.lessonProgress = [{ lessonId: 'l1', langId: 'de', status: 'completed', bestScore: 80, completedAt: 5 }];
    s.tables.dailyStats = [{ key: 'd:de', date: 'd', langId: 'de', xp: 30, ms: 10, reviews: 2, answered: 5, correct: 4 }];
    s.tables.achievements = [{ id: 'first', unlockedAt: 20 }];
  });
  const b = snap((s) => {
    s.tables.profile = [{ ...DEFAULT_PROFILE, name: 'B', langs: ['de'], createdAt: 1, updatedAt: 20 }];
    s.tables.cards = [card('de:x', { reps: 3, last_review: 70 }), card('de:z')];
    s.tables.reviewLogs = [
      { cardId: 'de:x', langId: 'de', rating: 3, reviewedAt: 50, elapsedMs: 900 },
      { cardId: 'de:x', langId: 'de', rating: 4, reviewedAt: 70, elapsedMs: 500 },
    ];
    s.tables.lessonProgress = [{ lessonId: 'l1', langId: 'de', status: 'completed', bestScore: 95, completedAt: 9 }];
    s.tables.dailyStats = [{ key: 'd:de', date: 'd', langId: 'de', xp: 12, ms: 40, reviews: 1, answered: 9, correct: 6 }];
    s.tables.achievements = [{ id: 'first', unlockedAt: 15 }];
    s.deleted = ['cards:de:y'];
  });

  it('combina cada tabla con su regla', () => {
    const m = mergeSnapshots(a, b);
    expect(m.tables.profile[0].name).toBe('B');
    expect(m.tables.profile[0].langs.sort()).toEqual(['de', 'pt']);
    expect(m.tables.cards.find((c) => c.id === 'de:x')?.reps).toBe(3);
    expect(m.tables.cards.map((c) => c.id).sort()).toEqual(['de:x', 'de:z']); // de:y borrada
    expect(m.tables.reviewLogs).toHaveLength(2);
    expect(m.tables.lessonProgress[0]).toMatchObject({ bestScore: 95, completedAt: 5 });
    expect(m.tables.dailyStats[0]).toMatchObject({ xp: 30, ms: 40, answered: 9, correct: 6 });
    expect(m.tables.achievements[0].unlockedAt).toBe(15);
  });

  it('es conmutativa e idempotente', () => {
    const ab = mergeSnapshots(a, b);
    const ba = mergeSnapshots(b, a);
    const sort = (s: SyncSnapshot) => ({
      ...s,
      tables: { ...s.tables, cards: [...s.tables.cards].sort((x, y) => x.id.localeCompare(y.id)) },
    });
    expect(sort(ab).tables.cards).toEqual(sort(ba).tables.cards);
    expect(ab.tables.profile).toEqual(ba.tables.profile);
    expect(mergeSnapshots(ab, ab)).toEqual(ab);
  });
});

describe('código de sincronización', () => {
  it('genera códigos válidos y los normaliza', () => {
    const code = generateSyncCode();
    expect(code).toMatch(SYNC_CODE_RE);
    expect(normalizeSyncCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code);
    expect(normalizeSyncCode('abc')).toBeNull();
    expect(normalizeSyncCode('0000-0000-0000-0000-0000')).toBeNull();
  });
});

describe('applySnapshot', () => {
  it('fusiona con lo local sin duplicar el historial', async () => {
    const database = new LingoDB(`sync-test-${Math.random()}`);
    await database.profile.put({ ...DEFAULT_PROFILE, name: 'Local', createdAt: 1, updatedAt: 5 });
    await database.cards.put(card('de:x', { reps: 1, last_review: 40 }));
    await database.reviewLogs.add({ cardId: 'de:x', langId: 'de', rating: 3, reviewedAt: 40, elapsedMs: 1 });

    const remote = snap((s) => {
      s.tables.profile = [{ ...DEFAULT_PROFILE, name: 'Nube', createdAt: 1, updatedAt: 9 }];
      s.tables.cards = [card('de:x', { reps: 2, last_review: 60 }), card('de:w')];
      s.tables.reviewLogs = [
        { cardId: 'de:x', langId: 'de', rating: 3, reviewedAt: 40, elapsedMs: 1 },
        { cardId: 'de:x', langId: 'de', rating: 2, reviewedAt: 60, elapsedMs: 1 },
      ];
    });
    await applySnapshot(remote, database);
    await applySnapshot(remote, database); // dos veces: no debe duplicar

    expect((await database.profile.get('me'))?.name).toBe('Nube');
    expect((await database.cards.get('de:x'))?.reps).toBe(2);
    expect(await database.cards.count()).toBe(2);
    expect(await database.reviewLogs.count()).toBe(2);

    const local = await localSnapshot(database);
    expect(local.tables.reviewLogs.every((r) => !('id' in r))).toBe(true);
    database.close();
  });
});
