import { beforeEach, describe, expect, it } from 'vitest';
import { LingoDB } from '@/db';
import { migrateLessonIds } from './content';

let db: LingoDB;
let n = 0;
beforeEach(() => {
  db = new LingoDB(`mig-${n++}`);
});

describe('migración de ids de lecciones', () => {
  it('pasa el progreso al id nuevo y es idempotente', async () => {
    await db.lessonProgress.bulkPut([
      { lessonId: 'zh-h1-u01-l4', langId: 'zh', status: 'completed', bestScore: 0.9, completedAt: 10 },
      { lessonId: 'zh-h1-u01-l1', langId: 'zh', status: 'completed', bestScore: 1, completedAt: 5 },
    ]);
    const map = { 'zh-h1-u01-l4': 'zh-g-saludos' };
    expect(await migrateLessonIds('zh', map, db)).toBe(1);
    expect((await db.lessonProgress.toArray()).map((r) => r.lessonId).sort()).toEqual(['zh-g-saludos', 'zh-h1-u01-l1']);
    expect((await db.lessonProgress.get('zh-g-saludos'))?.bestScore).toBe(0.9);
    expect(await migrateLessonIds('zh', map, db)).toBe(0);
  });
});
