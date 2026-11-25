/** Conexión a Postgres (Neon) para las funciones de Vercel. Una sola por instancia. */
import pg from 'pg';
import type { Db, Sql } from './rowstore.js';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta la variable DATABASE_URL');
  // Neon exige TLS; en local (PGlite o Postgres propio) se puede desactivar con sslmode=disable
  const ssl =
    /sslmode=disable/.test(connectionString) || /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)
      ? false
      : { rejectUnauthorized: true };
  // PG_POOL_MAX=1 en el servidor local con PGlite, que atiende una conexión a la vez
  pool = new pg.Pool({ connectionString, ssl, max: Number(process.env.PG_POOL_MAX) || 3, idleTimeoutMillis: 10_000 });
  return pool;
}

/** adapta un pool de pg a la interfaz que usa el almacén de filas */
const runner =
  (c: pg.Pool | pg.PoolClient): Sql['query'] =>
  <T>(text: string, params?: unknown[]) =>
    c.query(text, params) as unknown as Promise<{ rows: T[] }>;

export function asDb(p: pg.Pool): Db {
  return {
    query: runner(p),
    async tx(fn) {
      const client = await p.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ query: runner(client) });
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
