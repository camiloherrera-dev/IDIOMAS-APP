// @vitest-environment node
import 'fake-indexeddb/auto';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pgliteDb } from './pglite';
import { pullRows, pushRows, ROWS_DDL, type Db } from './rowstore';
import { DEFAULT_PROFILE, LingoDB, type CardRow } from '../../src/db/index';
import { markRemoteTransaction } from '../../src/db/stamps';
import {
  applyRemote,
  countPending,
  deviceId,
  getMeta,
  pendingBatch,
  resetSyncCursors,
  syncAccount,
  wipeLocal,
  type RowsApi,
} from '../../src/db/sync/account';

let pg: PGlite;
let server: Db;
let n = 0;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE "user" (id text PRIMARY KEY)`);
  for (const sql of ROWS_DDL) await pg.exec(sql);
});

beforeEach(async () => {
  await pg.exec(`DELETE FROM lingo_rows; DELETE FROM "user"; INSERT INTO "user" (id) VALUES ('camilo')`);
  server = pgliteDb(pg);
});

/** un "dispositivo": su propia base local y una API que habla con el mismo servidor */
async function device(user = 'camilo') {
  const local = new LingoDB(`dev-${n++}`);
  const id = await deviceId(local);
  const api: RowsApi = {
    push: (rows) => pushRows(server, user, id, JSON.parse(JSON.stringify(rows))),
    pull: (since) => pullRows(server, user, id, since, 7),
  };
  return { local, api, sync: () => syncAccount(local, api) };
}

const card = (id: string, patch: Partial<CardRow> = {}): CardRow => ({
  id,
  langId: 'zh',
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

describe('sincronización con la cuenta', () => {
  it('lo de un dispositivo llega al otro, incluidos el historial y los puntos débiles', async () => {
    const movil = await device();
    const pc = await device();
    await movil.local.profile.put({
      ...DEFAULT_PROFILE,
      name: 'Camilo',
      langs: ['zh'],
      activeLang: 'zh',
      createdAt: 1,
      updatedAt: 5,
    });
    await movil.local.cards.bulkPut(Array.from({ length: 30 }, (_, i) => card(`zh:w${i}`)));
    await movil.local.reviewLogs.add({ cardId: 'zh:w1', langId: 'zh', rating: 3, reviewedAt: 10, elapsedMs: 500 });
    await movil.local.skills.put({ key: 'zh:ba-oracion', langId: 'zh', skill: 'ba-oracion', wrong: 3, streak: 0, total: 4 });
    expect(await movil.sync()).toBe(true);
    expect(await countPending(movil.local)).toBe(0);

    expect(await pc.sync()).toBe(true);
    expect(await pc.local.cards.count()).toBe(30);
    expect((await pc.local.profile.get('me'))?.name).toBe('Camilo');
    expect(await pc.local.reviewLogs.count()).toBe(1);
    expect((await pc.local.skills.get('zh:ba-oracion'))?.wrong).toBe(3);
    // lo que llegó del servidor no queda pendiente de subir
    expect(await countPending(pc.local)).toBe(0);
  });

  it('gana el repaso más reciente de cada tarjeta y el otro dispositivo se corrige', async () => {
    const movil = await device();
    const pc = await device();
    await movil.local.cards.put(card('zh:a', { reps: 1, last_review: 10 }));
    await movil.sync();
    await pc.sync();
    // el PC repasa después; el móvil, sin conexión, repasa antes (hora más vieja)
    await pc.local.cards.put(card('zh:a', { reps: 2, last_review: 30 }));
    await movil.local.cards.put(card('zh:a', { reps: 2, last_review: 20 }));
    await pc.sync();
    await movil.sync();
    expect((await movil.local.cards.get('zh:a'))?.last_review).toBe(30);
    await pc.sync();
    expect((await pc.local.cards.get('zh:a'))?.last_review).toBe(30);
    expect(await countPending(movil.local)).toBe(0);
  });

  it('una nota escrita en un dispositivo no se pierde aunque la tarjeta no se haya repasado', async () => {
    const movil = await device();
    const pc = await device();
    await movil.local.cards.put(card('zh:a'));
    await movil.sync();
    await pc.sync();
    await pc.local.cards.update('zh:a', { note: 'parece un hombre corriendo' });
    await pc.sync();
    await movil.sync();
    expect((await movil.local.cards.get('zh:a'))?.note).toBe('parece un hombre corriendo');
  });

  it('los borrados viajan y no resucitan', async () => {
    const movil = await device();
    const pc = await device();
    await movil.local.customTerms.put({ id: 'mi1', langId: 'zh', term: '加油', meaning: 'ánimo', tags: [], createdAt: 1 });
    await movil.sync();
    await pc.sync();
    expect(await pc.local.customTerms.count()).toBe(1);
    await pc.local.transaction('rw', pc.local.customTerms, pc.local.tombstones, async () => {
      await pc.local.customTerms.delete('mi1');
      await pc.local.tombstones.put({ key: 'customTerms:mi1', tbl: 'customTerms', id: 'mi1' });
    });
    await pc.sync();
    await movil.sync();
    expect(await movil.local.customTerms.count()).toBe(0);
  });

  it('sube en lotes sin perder filas con la misma marca', async () => {
    const movil = await device();
    await movil.local.transaction('rw', movil.local.cards, async () => {
      markRemoteTransaction();
      // muchas filas con marcas repetidas (como tras la migración de una versión vieja)
      await movil.local.cards.bulkPut(
        Array.from({ length: 1200 }, (_, i) => ({ ...card(`zh:x${i}`), _ts: 1 + Math.floor(i / 400) }) as never),
      );
    });
    const first = await pendingBatch(movil.local, 0, 500);
    expect(first.rows.length).toBe(800); // no corta el grupo de marca 2
    await movil.sync();
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM lingo_rows`);
    expect(rows[0].n).toBe(1200);
  });

  it('aplicar lo remoto no pisa un cambio local más nuevo y lo deja pendiente', async () => {
    const movil = await device();
    await movil.local.cards.put(card('zh:a', { reps: 3, last_review: 50 }));
    await resetSyncCursors(movil.local);
    const before = await countPending(movil.local);
    await applyRemote(movil.local, [{ tbl: 'cards', id: 'zh:a', data: card('zh:a', { reps: 1, last_review: 10 }) as never }]);
    expect((await movil.local.cards.get('zh:a'))?.reps).toBe(3);
    expect(await countPending(movil.local)).toBeGreaterThanOrEqual(before);
  });

  it('borrar los datos del dispositivo conserva su id', async () => {
    const movil = await device();
    const id = await deviceId(movil.local);
    await movil.local.cards.put(card('zh:a'));
    await wipeLocal(movil.local);
    expect(await movil.local.cards.count()).toBe(0);
    expect(await getMeta(movil.local, 'deviceId', null)).toBe(id);
  });
});
