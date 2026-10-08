import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { db, type CardRow, type LingoDB } from '@/db';
import { recordActivity } from '../gamification';

export { Rating, State };
export type { Grade };

export const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true, maximum_interval: 3650 });

export const cardId = (langId: string, termId: string) => `${langId}:${termId}`;

export function rowToCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function cardToRow(card: Card, base: Pick<CardRow, 'id' | 'langId' | 'termId' | 'createdAt'>): CardRow {
  return {
    ...base,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime(),
  };
}

/** agrega términos al mazo; ignora los que ya existen. Devuelve cuántos son nuevos. */
export async function addTermsToDeck(langId: string, termIds: string[], now = new Date(), database: LingoDB = db) {
  const ids = termIds.map((t) => cardId(langId, t));
  const existing = new Set((await database.cards.bulkGet(ids)).filter(Boolean).map((c) => c!.id));
  const fresh = termIds
    .filter((t) => !existing.has(cardId(langId, t)))
    .map((termId) => cardToRow(createEmptyCard(now), { id: cardId(langId, termId), langId, termId, createdAt: now.getTime() }));
  if (fresh.length) await database.cards.bulkAdd(fresh);
  return fresh.length;
}

export async function gradeCard(id: string, grade: Grade, elapsedMs: number, now = new Date(), database: LingoDB = db) {
  const row = await database.cards.get(id);
  if (!row) throw new Error(`Tarjeta inexistente: ${id}`);
  const { card } = scheduler.next(rowToCard(row), now, grade);
  await database.transaction('rw', [database.cards, database.reviewLogs, database.dailyStats], async () => {
    await database.cards.put(cardToRow(card, row));
    await database.reviewLogs.add({ cardId: id, langId: row.langId, rating: grade, reviewedAt: now.getTime(), elapsedMs });
    await recordActivity(
      row.langId,
      {
        xp: grade === Rating.Again ? 1 : 3,
        ms: Math.min(elapsedMs, 60_000),
        reviews: 1,
        answered: 1,
        correct: grade === Rating.Again ? 0 : 1,
      },
      now,
      database,
    );
  });
  return card;
}

/** intervalos previstos para mostrar bajo cada botón de calificación */
export function previewIntervals(row: CardRow, now = new Date()): Record<Grade, string> {
  const preview = scheduler.repeat(rowToCard(row), now);
  const fmt = (due: Date) => formatInterval(due.getTime() - now.getTime());
  return {
    [Rating.Again]: fmt(preview[Rating.Again].card.due),
    [Rating.Hard]: fmt(preview[Rating.Hard].card.due),
    [Rating.Good]: fmt(preview[Rating.Good].card.due),
    [Rating.Easy]: fmt(preview[Rating.Easy].card.due),
  } as Record<Grade, string>;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mes${mo > 1 ? 'es' : ''}`;
  return `${(d / 365).toFixed(1).replace('.0', '')} a`;
}

/**
 * Cola de repaso: tarjetas vencidas (hasta `reviewCap`) y nuevas (hasta `newPerDay`
 * menos las nuevas ya vistas hoy). Las vencidas van primero, las más atrasadas antes.
 */
export async function buildReviewQueue(
  langId: string,
  opts: { reviewCap: number; newPerDay: number; newSeenToday: number },
  now = new Date(),
  database: LingoDB = db,
): Promise<CardRow[]> {
  const due = await database.cards.where('[langId+due]').between([langId, 0], [langId, now.getTime()], true, true).toArray();
  const learned = due.filter((c) => c.state !== State.New).slice(0, opts.reviewCap);
  const newOnes = due
    .filter((c) => c.state === State.New)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, opts.newPerDay - opts.newSeenToday));
  return [...learned, ...newOnes];
}

/** cuántas tarjetas nuevas se estudiaron por primera vez hoy */
export async function countNewSeenToday(langId: string, now = new Date(), database: LingoDB = db) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const logs = await database.reviewLogs.where('reviewedAt').aboveOrEqual(start.getTime()).toArray();
  const firstSeen = new Set<string>();
  const ids = [...new Set(logs.filter((l) => l.langId === langId).map((l) => l.cardId))];
  for (const id of ids) {
    const earliest = await database.reviewLogs.where('cardId').equals(id).first();
    if (earliest && earliest.reviewedAt >= start.getTime()) firstSeen.add(id);
  }
  return firstSeen.size;
}

/** previsión de repasos para los próximos `days` días */
export async function forecast(langId: string, days = 14, now = new Date(), database: LingoDB = db) {
  const cards = await database.cards.where('langId').equals(langId).toArray();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => ({ day: i, count: 0 }));
  for (const c of cards) {
    if (c.state === State.New) continue;
    const idx = Math.max(0, Math.floor((c.due - start.getTime()) / 86_400_000));
    if (idx < days) buckets[idx].count++;
  }
  return buckets;
}
