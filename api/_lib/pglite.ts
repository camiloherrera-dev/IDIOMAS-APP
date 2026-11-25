/** adaptador de PGlite (Postgres en WebAssembly) para las pruebas y el servidor local */
import type { PGlite, Transaction } from '@electric-sql/pglite';
import type { Db, Sql } from './rowstore.js';

const runner =
  (c: PGlite | Transaction): Sql['query'] =>
  async <T>(text: string, params?: unknown[]) => {
    const r = await c.query<T>(text, params as unknown[]);
    return { rows: r.rows };
  };

export function pgliteDb(pg: PGlite): Db {
  return {
    query: runner(pg),
    tx: (fn) => pg.transaction((t) => fn({ query: runner(t) })),
  };
}
