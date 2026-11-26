import { beforeEach, describe, expect, it } from 'vitest';
import { LingoDB, type CardKind } from '@/db';
import { exportData, importData, wipeData } from '@/db/backup';
import {
  addKnownTerms,
  addTermsToDeck,
  availableAt,
  buildFreeQueue,
  buildReviewQueue,
  formatNextAt,
  gradeFree,
  nextAvailable,
  cardId,
  coverageOf,
  gradeCard,
  kindOf,
  Rating,
  setSuspended,
  State,
  termsInDeck,
  undoGrade,
} from './index';

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
    const q = await buildReviewQueue('pt', { reviewCap: 50, newPerDay: 2, seen: 0 }, new Date(), db);
    expect(q).toHaveLength(2);
    expect(q.every((c) => c.state === State.New)).toBe(true);
  });

  it('calificar programa la tarjeta, registra el log y suma XP', async () => {
    const now = new Date(2026, 9, 8, 10);
    await addTermsToDeck('pt', ['a'], now, db);
    const { card } = await gradeCard(cardId('pt', 'a'), Rating.Good, 4000, now, db);
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
    const q = await buildReviewQueue('pt', { reviewCap: 50, newPerDay: 10, seen: 0 }, now, db);
    expect(q).toHaveLength(0);
  });

  it('la cola separa idiomas', async () => {
    await addTermsToDeck('pt', ['a'], new Date(), db);
    await addTermsToDeck('zh', ['x', 'y'], new Date(), db);
    const q = await buildReviewQueue('zh', { reviewCap: 50, newPerDay: 10, seen: 0 }, new Date(), db);
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

describe('tarjetas hermanas, deshacer y sanguijuelas', () => {
  const day = 86_400_000;
  const opts = { siblingKinds: ['listen', 'produce'] as CardKind[] };

  it('al consolidar reconocer nacen las tarjetas de escuchar y de escribir', async () => {
    const now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['w1'], now, db);
    await gradeCard(cardId('zh', 'w1'), Rating.Easy, 2000, now, db, opts);
    const ids = (await db.cards.toArray()).map((c) => c.id).sort();
    expect(ids).toEqual(['zh:w1', 'zh:w1#listen', 'zh:w1#produce']);
    expect(kindOf((await db.cards.get('zh:w1#listen'))!)).toBe('listen');
  });

  it('sin tipos extra activados no se crean hermanas', async () => {
    const now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['w1'], now, db);
    await gradeCard(cardId('zh', 'w1'), Rating.Easy, 2000, now, db);
    expect(await db.cards.count()).toBe(1);
  });

  it('la cola no muestra dos tarjetas de la misma palabra el mismo día', async () => {
    const now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['w1', 'w2'], now, db);
    await gradeCard(cardId('zh', 'w1'), Rating.Easy, 2000, now, db, opts);
    await gradeCard(cardId('zh', 'w2'), Rating.Easy, 2000, now, db, opts);
    const later = new Date(now.getTime() + 2 * day);
    const q = await buildReviewQueue('zh', { reviewCap: 50, newPerDay: 10, seen: 0 }, later, db);
    const terms = q.map((c) => c.termId);
    expect(new Set(terms).size).toBe(terms.length);
    expect(q.length).toBeGreaterThan(0);
  });

  it('deshacer restaura la tarjeta, borra el registro y las hermanas recién creadas', async () => {
    const now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['w1'], now, db);
    const before = await db.cards.get('zh:w1');
    const { undo } = await gradeCard(cardId('zh', 'w1'), Rating.Easy, 2000, now, db, opts);
    await undoGrade(undo, db);
    // el contenido vuelve a ser el de antes; solo cambian las marcas de sincronización
    const strip = (c: object | undefined) => {
      const { _ts, _m, ...rest } = (c ?? {}) as Record<string, unknown>;
      void _ts;
      void _m;
      return rest;
    };
    expect(strip(await db.cards.get('zh:w1'))).toEqual(strip(before));
    expect(await db.cards.count()).toBe(1);
    expect(await db.reviewLogs.count()).toBe(0);
    const stats = await db.dailyStats.toArray();
    expect(stats[0].reviews).toBe(0);
  });

  it('una tarjeta fallada muchas veces se aparta sola y deja de salir', async () => {
    let now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['w1'], now, db);
    await gradeCard('zh:w1', Rating.Easy, 1000, now, db);
    let leech = false;
    for (let i = 0; i < 40 && !leech; i++) {
      const row = (await db.cards.get('zh:w1'))!;
      now = new Date(Math.max(row.due, now.getTime()) + day);
      // fallo y vuelta a graduar, para que cada ciclo cuente como un lapso
      leech = (await gradeCard('zh:w1', Rating.Again, 1000, now, db)).leech;
      if (leech) break;
      for (let k = 0; k < 4; k++) {
        const r = (await db.cards.get('zh:w1'))!;
        if (r.state === State.Review) break;
        now = new Date(Math.max(r.due, now.getTime()) + 60_000);
        await gradeCard('zh:w1', Rating.Good, 1000, now, db);
      }
    }
    expect(leech).toBe(true);
    const row = (await db.cards.get('zh:w1'))!;
    expect(row.suspended).toBe(true);
    const q = await buildReviewQueue('zh', { reviewCap: 50, newPerDay: 10, seen: 0 }, new Date(now.getTime() + 30 * day), db);
    expect(q).toHaveLength(0);
    await setSuspended('zh:w1', false, db);
    expect((await db.cards.get('zh:w1'))!.suspended).toBe(false);
  });

  it('las palabras de un nivel saltado entran como conocidas y repartidas', async () => {
    const now = new Date(2026, 10, 1, 9);
    const ids = Array.from({ length: 30 }, (_, i) => `k${i}`);
    expect(await addKnownTerms('zh', ids, now, db)).toBe(30);
    const rows = await db.cards.toArray();
    expect(rows.every((c) => c.state === State.Review)).toBe(true);
    expect(await buildReviewQueue('zh', { reviewCap: 50, newPerDay: 10, seen: 0 }, now, db)).toHaveLength(0);
    const days = new Set(rows.map((c) => Math.round((c.due - now.getTime()) / day)));
    expect(days.size).toBeGreaterThan(10);
    // no duplica lo que ya está en el mazo, tampoco bajo un id antiguo
    expect(await addKnownTerms('zh', ['k1', 'nuevo'], now, db, { viejo: 'nuevo' })).toBe(1);
    await db.cards.clear();
    await addTermsToDeck('zh', ['viejo'], now, db);
    expect(await addTermsToDeck('zh', ['nuevo'], now, db, { viejo: 'nuevo' })).toBe(0);
  });

  it('la cobertura cuenta palabras vistas y consolidadas', async () => {
    const now = new Date(2026, 10, 1, 9);
    await addTermsToDeck('zh', ['a', 'b'], now, db);
    await addKnownTerms('zh', ['c'], now, db);
    const cov = coverageOf(['a', 'b', 'c', 'd'], await termsInDeck('zh', undefined, db));
    expect(cov.total).toBe(4);
    expect(cov.inDeck).toBe(3);
    expect(cov.known).toBe(0);
  });
});

describe('repaso por días y repaso libre', () => {
  const q = (now: Date, extra: Partial<Parameters<typeof buildReviewQueue>[1]> = {}) =>
    buildReviewQueue('zh', { reviewCap: 500, newPerDay: 8, seen: 0, nextDayNew: true, ...extra }, now, db);

  it('las palabras de una lección esperan a mañana y entonces salen todas, sin límite diario', async () => {
    const lesson = new Date(2026, 10, 26, 13, 5);
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`);
    await addTermsToDeck('zh', words, lesson, db);
    expect(await q(new Date(2026, 10, 26, 23, 59))).toHaveLength(0);
    // apenas pasa la medianoche, salen las 30
    expect(await q(new Date(2026, 10, 27, 0, 1))).toHaveLength(30);
    // sin la opción, se respeta el cupo diario
    expect(await q(new Date(2026, 10, 27, 0, 1), { nextDayNew: false })).toHaveLength(8);
  });

  it('un repaso que vence mañana a cualquier hora ya sale desde la medianoche', async () => {
    const day1 = new Date(2026, 10, 26, 13, 0);
    await addTermsToDeck('zh', ['a'], day1, db);
    const row = await db.cards.get(cardId('zh', 'a'));
    await db.cards.put({ ...row!, state: State.Review, due: new Date(2026, 10, 27, 18, 0).getTime(), stability: 2 });
    expect(await q(new Date(2026, 10, 27, 0, 1))).toHaveLength(1);
    expect(await q(new Date(2026, 10, 26, 23, 0))).toHaveLength(0);
  });

  it('los pasos de aprendizaje siguen yendo al minuto', async () => {
    const now = new Date(2026, 10, 26, 10, 0);
    await addTermsToDeck('zh', ['a'], new Date(2026, 10, 25, 9), db);
    await gradeCard(cardId('zh', 'a'), Rating.Good, 1000, now, db);
    const row = (await db.cards.get(cardId('zh', 'a')))!;
    expect(row.state).toBe(State.Learning);
    expect(availableAt(row, true)).toBe(row.due);
    expect(await q(now)).toHaveLength(0);
  });

  it('el próximo repaso de una lección de hoy es "mañana"', async () => {
    const now = new Date(2026, 10, 26, 13, 5);
    await addTermsToDeck('zh', ['a'], now, db);
    const next = nextAvailable(await db.cards.toArray(), now, true)!;
    expect(next).toBe(new Date(2026, 10, 27).getTime());
    expect(formatNextAt(next, now)).toBe('mañana');
  });

  it('el repaso libre trae todas las tarjetas pedidas, mezcladas, aunque no toquen', async () => {
    await addTermsToDeck('zh', ['a', 'b', 'c'], new Date(), db);
    await setSuspended(cardId('zh', 'c'), true, db);
    const free = await buildFreeQueue('zh', new Set(['a', 'b', 'c']), db, () => 0);
    expect(free.map((c) => c.termId).sort()).toEqual(['a', 'b']);
  });

  it('practicar una tarjeta que no tocaba no cambia su programación; fallarla la trae a mañana', async () => {
    const now = new Date(2026, 10, 26, 13, 0);
    await addTermsToDeck('zh', ['a', 'b'], new Date(2026, 10, 1), db);
    for (const t of ['a', 'b']) {
      const row = (await db.cards.get(cardId('zh', t)))!;
      await db.cards.put({
        ...row,
        state: State.Review,
        stability: 20,
        due: new Date(2026, 11, 10).getTime(),
        last_review: new Date(2026, 10, 20).getTime(),
      });
    }
    const before = (await db.cards.get(cardId('zh', 'a')))!;
    const good = await gradeFree(cardId('zh', 'a'), Rating.Good, 1000, now, db, { nextDayNew: true });
    expect(good.counted).toBe(false);
    expect(await db.cards.get(cardId('zh', 'a'))).toEqual(before);
    expect(await db.reviewLogs.count()).toBe(0);

    await gradeFree(cardId('zh', 'b'), Rating.Again, 1000, now, db, { nextDayNew: true });
    expect((await db.cards.get(cardId('zh', 'b')))!.due).toBe(new Date(2026, 10, 27).getTime());

    // y se puede deshacer
    const again = await gradeFree(cardId('zh', 'a'), Rating.Again, 1000, now, db, { nextDayNew: true });
    await undoGrade(again.undo, db);
    const {
      _ts: _a,
      _m: _b,
      ...restored
    } = (await db.cards.get(cardId('zh', 'a')))! as typeof before & { _ts?: number; _m?: number };
    const { _ts: _c, _m: _d, ...original } = before as typeof before & { _ts?: number; _m?: number };
    expect(restored).toEqual(original);
  });

  it('en repaso libre, una tarjeta que sí tocaba hoy cuenta como repaso normal', async () => {
    const now = new Date(2026, 10, 26, 13, 0);
    await addTermsToDeck('zh', ['a'], new Date(2026, 10, 25), db);
    const res = await gradeFree(cardId('zh', 'a'), Rating.Good, 1000, now, db, { nextDayNew: true });
    expect(res.counted).toBe(true);
    expect(await db.reviewLogs.count()).toBe(1);
  });
});
