import { z } from 'zod';
import { db, type LingoDB } from './index';

const TABLES = ['profile', 'cards', 'reviewLogs', 'lessonProgress', 'customTerms', 'dailyStats', 'achievements'] as const;

const backupSchema = z.object({
  app: z.literal('lingo-lab'),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.object(
    Object.fromEntries(TABLES.map((t) => [t, z.array(z.record(z.string(), z.unknown()))])) as Record<
      (typeof TABLES)[number],
      z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>
    >,
  ),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportData(database: LingoDB = db): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const name of TABLES) {
    tables[name] = (await database.table(name).toArray()) as Record<string, unknown>[];
  }
  return { app: 'lingo-lab', version: database.verno, exportedAt: new Date().toISOString(), tables };
}

export async function downloadBackup(): Promise<void> {
  const data = await exportData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lingo-lab-${data.exportedAt.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** reemplaza todos los datos locales por los del respaldo */
export async function importData(raw: unknown, database: LingoDB = db): Promise<{ cards: number }> {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new Error('El archivo no es un respaldo válido de Lingo Lab.');
  const { tables } = parsed.data;
  await database.transaction(
    'rw',
    TABLES.map((t) => database.table(t)),
    async () => {
      for (const name of TABLES) {
        const table = database.table(name);
        await table.clear();
        if (tables[name].length) await table.bulkPut(tables[name]);
      }
    },
  );
  return { cards: tables.cards.length };
}

export async function wipeData(database: LingoDB = db): Promise<void> {
  await database.transaction(
    'rw',
    TABLES.map((t) => database.table(t)),
    async () => {
      for (const name of TABLES) await database.table(name).clear();
    },
  );
}
