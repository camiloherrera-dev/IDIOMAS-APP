// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptySnapshot, type SyncRow } from '../../src/db/sync/merge';
import { pgliteDb } from './pglite';
import { hashSyncCode, importLegacyCode, pullRows, pushRows, ROWS_DDL, type Db } from './rowstore';

let pg: PGlite;
let db: Db;

beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE "user" (id text PRIMARY KEY)`);
  for (const sql of ROWS_DDL) await pg.exec(sql);
  await pg.exec(`INSERT INTO "user" (id) VALUES ('ana'), ('beto')`);
  db = pgliteDb(pg);
});

const card = (id: string, patch: Record<string, unknown> = {}): SyncRow => ({
  tbl: 'cards',
  id,
  data: {
    id,
    langId: 'zh',
    termId: id,
    createdAt: 1,
    due: 10,
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    ...patch,
  },
});

describe('almacén de filas', () => {
  it('guarda, devuelve a los otros dispositivos y no al que escribió', async () => {
    await pushRows(db, 'ana', 'movil', [card('zh:a'), card('zh:b')]);
    const own = await pullRows(db, 'ana', 'movil', 0);
    expect(own.rows).toHaveLength(0);
    expect(own.next).toBeGreaterThan(0);
    const other = await pullRows(db, 'ana', 'pc', 0);
    expect(other.rows.map((r) => r.id).sort()).toEqual(['zh:a', 'zh:b']);
  });

  it('aísla a cada usuario', async () => {
    await pushRows(db, 'ana', 'movil', [card('zh:a')]);
    expect((await pullRows(db, 'beto', 'pc', 0)).rows).toHaveLength(0);
  });

  it('fusiona con la regla de la tabla y avisa si el resultado no es lo enviado', async () => {
    await pushRows(db, 'ana', 'movil', [card('zh:a', { reps: 3, last_review: 50 })]);
    const { changed, applied } = await pushRows(db, 'ana', 'pc', [card('zh:a', { reps: 1, last_review: 20 })]);
    expect(applied).toBe(0);
    expect(changed).toHaveLength(1);
    expect(changed[0].data?.reps).toBe(3);
  });

  it('una versión más nueva reemplaza y le llega al otro dispositivo', async () => {
    await pushRows(db, 'ana', 'movil', [card('zh:a', { reps: 1, last_review: 20 })]);
    const first = await pullRows(db, 'ana', 'pc', 0);
    await pushRows(db, 'ana', 'movil', [card('zh:a', { reps: 2, last_review: 40 })]);
    const second = await pullRows(db, 'ana', 'pc', first.next);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0].data?.reps).toBe(2);
  });

  it('un borrado es definitivo', async () => {
    await pushRows(db, 'ana', 'movil', [{ tbl: 'customTerms', id: 'x', data: { id: 'x', createdAt: 1 } }]);
    await pushRows(db, 'ana', 'movil', [{ tbl: 'customTerms', id: 'x', data: null, deleted: true }]);
    const res = await pushRows(db, 'ana', 'pc', [{ tbl: 'customTerms', id: 'x', data: { id: 'x', createdAt: 5 } }]);
    expect(res.changed).toEqual([{ tbl: 'customTerms', id: 'x', data: null, deleted: true }]);
    const pulled = await pullRows(db, 'ana', 'tablet', 0);
    expect(pulled.rows).toEqual([{ tbl: 'customTerms', id: 'x', data: null, deleted: true }]);
  });

  it('el historial de repasos no se duplica', async () => {
    const log = {
      tbl: 'reviewLogs' as const,
      id: 'zh:a|100',
      data: { cardId: 'zh:a', langId: 'zh', rating: 3, reviewedAt: 100, elapsedMs: 900 },
    };
    await pushRows(db, 'ana', 'movil', [log]);
    await pushRows(db, 'ana', 'pc', [log]);
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM lingo_rows`);
    expect(rows[0].n).toBe(1);
  });

  it('pagina el pull', async () => {
    await pushRows(
      db,
      'ana',
      'movil',
      Array.from({ length: 25 }, (_, i) => card(`zh:${i}`)),
    );
    let since = 0;
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const page = await pullRows(db, 'ana', 'pc', since, 10);
      seen.push(...page.rows.map((r) => r.id));
      since = page.next;
      if (!page.more) break;
    }
    expect(seen).toHaveLength(25);
  });

  it('borrar el usuario borra sus filas', async () => {
    await pushRows(db, 'ana', 'movil', [card('zh:a')]);
    await pg.exec(`DELETE FROM "user" WHERE id = 'ana'`);
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM lingo_rows`);
    expect(rows[0].n).toBe(0);
  });

  it('importa un código antiguo y borra la fila anterior', async () => {
    await pg.exec(`CREATE TABLE lingo_sync (id text PRIMARY KEY, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1)`);
    const snap = emptySnapshot();
    snap.tables.cards = [card('zh:a').data as never];
    snap.tables.reviewLogs = [{ cardId: 'zh:a', langId: 'zh', rating: 3, reviewedAt: 5, elapsedMs: 1 }];
    snap.deleted = ['customTerms:viejo'];
    await pg.query(`INSERT INTO lingo_sync (id, data) VALUES ($1, $2)`, [
      hashSyncCode('ABCD-EFGH-JKLM-NPQR-STUV'),
      JSON.stringify(snap),
    ]);
    expect(await importLegacyCode(db, 'ana', 'ABCD-EFGH-JKLM-NPQR-STUV')).toBe(3);
    expect(await importLegacyCode(db, 'ana', 'ABCD-EFGH-JKLM-NPQR-STUV')).toBeNull();
    const pulled = await pullRows(db, 'ana', 'cualquiera', 0);
    expect(pulled.rows.map((r) => `${r.tbl}:${r.id}`).sort()).toEqual(['cards:zh:a', 'customTerms:viejo', 'reviewLogs:zh:a|5']);
  });
});
