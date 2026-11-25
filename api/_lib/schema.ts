/**
 * Crea o actualiza las tablas la primera vez que una instancia recibe una petición:
 * las de Better Auth (user, session, account, verification, rateLimit) y las de
 * sincronización.
 *
 * Sin candados de sesión: Neon reparte las consultas con un pooler (PgBouncer) y un candado
 * de sesión podría quedar tomado en otra conexión. Si dos instancias migran a la vez y una
 * choca ("ya existe"), se reintenta: la segunda vez la migración ve las tablas y no hace nada.
 */
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from './auth.js';
import { getPool } from './db.js';
import { ROWS_DDL } from './rowstore.js';

let ready: Promise<void> | null = null;

async function migrate() {
  const { runMigrations } = await getMigrations(authOptions());
  await runMigrations();
  for (const sql of ROWS_DDL) await getPool().query(sql);
}

export function ensureSchema(): Promise<void> {
  ready ??= migrate()
    .catch(async () => {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
      await migrate();
    })
    .catch((err: unknown) => {
      ready = null;
      throw err;
    });
  return ready;
}
