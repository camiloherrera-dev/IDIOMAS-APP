import { createEmptyCard, fsrs, Rating, State, type Card, type FSRS, type Grade } from 'ts-fsrs';
import { db, type CardKind, type CardRow, type LingoDB } from '@/db';
import { recordActivity, type Activity } from '../gamification';

export { Rating, State };
export type { Grade };

export const DEFAULT_RETENTION = 0.9;
/** una palabra cuenta como "conocida" cuando su memoria aguanta al menos tres semanas */
export const KNOWN_STABILITY_DAYS = 21;
/** fallos a partir de los cuales una tarjeta se aparta como "difícil" */
export const LEECH_LAPSES = 6;

const schedulers = new Map<number, FSRS>();

/** planificador FSRS para una retención deseada (0.8 a 0.95) */
export function getScheduler(retention: number = DEFAULT_RETENTION): FSRS {
  const r = Math.min(0.95, Math.max(0.8, Math.round(retention * 100) / 100));
  let s = schedulers.get(r);
  if (!s) {
    s = fsrs({ request_retention: r, enable_fuzz: true, maximum_interval: 3650 });
    schedulers.set(r, s);
  }
  return s;
}

export const scheduler = getScheduler();

export const cardId = (langId: string, termId: string, kind: CardKind = 'recog') =>
  kind === 'recog' ? `${langId}:${termId}` : `${langId}:${termId}#${kind}`;

export const kindOf = (row: Pick<CardRow, 'kind'>): CardKind => row.kind ?? 'recog';

export const SIBLING_KINDS: CardKind[] = ['listen', 'produce'];

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

export function cardToRow<B extends Pick<CardRow, 'id' | 'langId' | 'termId' | 'createdAt'>>(card: Card, base: B): B & CardRow {
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

/** ids antiguos que apuntan a cada término actual */
function legacyIdsOf(legacy: Record<string, string> | undefined): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [old, current] of Object.entries(legacy ?? {})) out.set(current, [...(out.get(current) ?? []), old]);
  return out;
}

/** términos (ids actuales) que ya tienen tarjeta de reconocer, contando las de ids antiguos */
export async function termsInDeck(
  langId: string,
  legacy?: Record<string, string>,
  database: LingoDB = db,
): Promise<Map<string, CardRow>> {
  const cards = await database.cards.where('langId').equals(langId).toArray();
  const out = new Map<string, CardRow>();
  for (const c of cards) {
    if (kindOf(c) !== 'recog') continue;
    const id = legacy?.[c.termId] ?? c.termId;
    const prev = out.get(id);
    if (!prev || c.stability > prev.stability) out.set(id, c);
  }
  return out;
}

/** agrega términos al mazo; ignora los que ya existen (también bajo un id antiguo). Devuelve cuántos son nuevos. */
export async function addTermsToDeck(
  langId: string,
  termIds: string[],
  now = new Date(),
  database: LingoDB = db,
  legacy?: Record<string, string>,
) {
  const olds = legacyIdsOf(legacy);
  const candidates = termIds.map((t) => [t, ...(olds.get(t) ?? [])].map((x) => cardId(langId, x)));
  const found = await database.cards.bulkGet(candidates.flat());
  const existing = new Set(found.filter(Boolean).map((c) => c!.id));
  const fresh = termIds
    .filter((_, i) => !candidates[i].some((id) => existing.has(id)))
    .map((termId) => cardToRow(createEmptyCard(now), { id: cardId(langId, termId), langId, termId, createdAt: now.getTime() }));
  if (fresh.length) await database.cards.bulkAdd(fresh);
  return fresh.length;
}

/**
 * Agrega palabras que el usuario ya sabe (saltó el nivel con una prueba): entran
 * como tarjetas ya aprendidas y se reparten en las próximas tres semanas para
 * comprobarlas poco a poco, sin inundar la cola de nuevas.
 */
export async function addKnownTerms(
  langId: string,
  termIds: string[],
  now = new Date(),
  database: LingoDB = db,
  legacy?: Record<string, string>,
) {
  const olds = legacyIdsOf(legacy);
  const candidates = termIds.map((t) => [t, ...(olds.get(t) ?? [])].map((x) => cardId(langId, x)));
  const found = await database.cards.bulkGet(candidates.flat());
  const existing = new Set(found.filter(Boolean).map((c) => c!.id));
  const fresh = termIds.filter((_, i) => !candidates[i].some((id) => existing.has(id)));
  const s = getScheduler();
  const rows = fresh.map((termId, i) => {
    const { card } = s.next(createEmptyCard(now), now, Rating.Easy);
    const days = 2 + ((i * 7) % 20);
    const due = new Date(now.getTime() + days * 86_400_000);
    return cardToRow(
      { ...card, due, scheduled_days: days },
      { id: cardId(langId, termId), langId, termId, createdAt: now.getTime() },
    );
  });
  if (rows.length) await database.cards.bulkAdd(rows);
  return rows.length;
}

export interface GradeOptions {
  retention?: number;
  /** tipos de tarjeta hermana que se crean cuando la de reconocer ya se sostiene */
  siblingKinds?: CardKind[];
}

export interface GradeResult {
  card: Card;
  /** datos para deshacer este repaso */
  undo: UndoToken;
  /** la tarjeta se apartó sola por fallarla demasiado */
  leech: boolean;
}

export interface UndoToken {
  prev: CardRow;
  logId: number;
  activity: Activity;
  at: number;
  siblings: string[];
}

export async function gradeCard(
  id: string,
  grade: Grade,
  elapsedMs: number,
  now = new Date(),
  database: LingoDB = db,
  opts: GradeOptions = {},
): Promise<GradeResult> {
  const row = await database.cards.get(id);
  if (!row) throw new Error(`Tarjeta inexistente: ${id}`);
  const { card } = getScheduler(opts.retention).next(rowToCard(row), now, grade);
  const lapsed = card.lapses > row.lapses;
  const leech = lapsed && card.lapses >= LEECH_LAPSES && (card.lapses - LEECH_LAPSES) % 3 === 0;
  const next: CardRow = { ...cardToRow(card, row), ...(leech ? { suspended: true, leech: true } : {}) };

  // cuando reconocer ya aguanta unos días, nacen las tarjetas de escuchar y de producir
  const siblings: CardRow[] = [];
  if (kindOf(row) === 'recog' && card.state === State.Review && card.scheduled_days >= 2) {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    for (const kind of opts.siblingKinds ?? []) {
      if (kind === 'recog') continue;
      const sid = cardId(row.langId, row.termId, kind);
      if (!(await database.cards.get(sid)))
        siblings.push({
          ...cardToRow(createEmptyCard(tomorrow), { id: sid, langId: row.langId, termId: row.termId, createdAt: now.getTime() }),
          kind,
        });
    }
  }

  const activity: Activity = {
    xp: grade === Rating.Again ? 1 : 3,
    ms: Math.min(elapsedMs, 60_000),
    reviews: 1,
    answered: 1,
    correct: grade === Rating.Again ? 0 : 1,
  };
  let logId = 0;
  await database.transaction('rw', [database.cards, database.reviewLogs, database.dailyStats], async () => {
    await database.cards.put(next);
    if (siblings.length) await database.cards.bulkPut(siblings);
    logId = (await database.reviewLogs.add({
      cardId: id,
      langId: row.langId,
      rating: grade,
      reviewedAt: now.getTime(),
      elapsedMs,
      state: row.state,
      stability: row.stability,
      difficulty: row.difficulty,
      scheduled_days: row.scheduled_days,
      elapsed_days: row.last_review ? Math.max(0, Math.round((now.getTime() - row.last_review) / 86_400_000)) : 0,
    })) as number;
    await recordActivity(row.langId, activity, now, database);
  });
  return { card, leech, undo: { prev: row, logId, activity, at: now.getTime(), siblings: siblings.map((s) => s.id) } };
}

/** deshace el último repaso: restaura la tarjeta, borra su registro y descuenta la actividad */
export async function undoGrade(token: UndoToken, database: LingoDB = db) {
  await database.transaction('rw', [database.cards, database.reviewLogs, database.dailyStats], async () => {
    await database.cards.put(token.prev);
    if (token.logId >= 0) await database.reviewLogs.delete(token.logId);
    for (const id of token.siblings) {
      const s = await database.cards.get(id);
      if (s && s.state === State.New) await database.cards.delete(id);
    }
    const a = token.activity;
    await recordActivity(
      token.prev.langId,
      { xp: -a.xp, ms: -a.ms, reviews: -a.reviews, answered: -a.answered, correct: -a.correct },
      new Date(token.at),
      database,
    );
  });
}

export async function setSuspended(id: string, suspended: boolean, database: LingoDB = db) {
  const row = await database.cards.get(id);
  if (row) await database.cards.put({ ...row, suspended, leech: suspended ? row.leech : false });
}

/** intervalos previstos para mostrar bajo cada botón de calificación */
export function previewIntervals(row: CardRow, now = new Date(), retention?: number): Record<Grade, string> {
  const preview = getScheduler(retention).repeat(rowToCard(row), now);
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

function startOfDay(now: Date): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export interface NewSeen {
  /** palabras nuevas (tarjetas de reconocer) vistas hoy por primera vez */
  words: number;
  /** tarjetas hermanas (escuchar, producir) vistas hoy por primera vez */
  extra: number;
  /** términos con algún repaso hoy (para no mostrar dos tarjetas de la misma palabra el mismo día) */
  terms: Set<string>;
}

const termOfCardId = (id: string) => id.slice(id.indexOf(':') + 1).split('#')[0];

/** qué se estudió hoy por primera vez y qué palabras ya se tocaron */
export async function newSeenToday(langId: string, now = new Date(), database: LingoDB = db): Promise<NewSeen> {
  const start = startOfDay(now);
  const logs = (await database.reviewLogs.where('reviewedAt').aboveOrEqual(start).toArray()).filter((l) => l.langId === langId);
  const ids = [...new Set(logs.map((l) => l.cardId))];
  let words = 0;
  let extra = 0;
  for (const id of ids) {
    const earliest = await database.reviewLogs.where('cardId').equals(id).first();
    if (earliest && earliest.reviewedAt >= start) {
      if (id.includes('#')) extra++;
      else words++;
    }
  }
  return { words, extra, terms: new Set(ids.map(termOfCardId)) };
}

/** cuántas palabras nuevas se estudiaron por primera vez hoy */
export async function countNewSeenToday(langId: string, now = new Date(), database: LingoDB = db) {
  return (await newSeenToday(langId, now, database)).words;
}

export interface QueueOptions {
  reviewCap: number;
  newPerDay: number;
  /** resultado de `newSeenToday`; un número se interpreta como palabras nuevas ya vistas */
  seen: NewSeen | number;
  /**
   * Las palabras que entran al mazo (al terminar una lección) se repasan todas desde
   * el día siguiente, sin límite diario. Las que entraron hoy esperan a mañana.
   */
  nextDayNew?: boolean;
}

const DAY = 86_400_000;

/** inicio del día siguiente (medianoche local) */
export function startOfTomorrow(now: Date): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

const inSteps = (c: Pick<CardRow, 'state'>) => c.state === State.Learning || c.state === State.Relearning;

/**
 * Momento desde el que una tarjeta se puede repasar. Los pasos de aprendizaje van al
 * minuto; los repasos cuentan por días: una tarjeta que vence hoy a cualquier hora ya
 * está disponible desde la medianoche. Con `nextDayNew`, una palabra nueva espera al
 * día siguiente de haber entrado al mazo.
 */
export function availableAt(c: CardRow, nextDayNew = false): number {
  if (inSteps(c)) return c.due;
  if (nextDayNew && c.state === State.New && kindOf(c) === 'recog')
    return Math.max(startOfDay(new Date(c.due)), startOfTomorrow(new Date(c.createdAt)));
  return startOfDay(new Date(c.due));
}

/** próximo momento en que habrá algo que repasar (o null si no hay nada programado) */
export function nextAvailable(cards: CardRow[], now = new Date(), nextDayNew = false): number | null {
  let best: number | null = null;
  for (const c of cards) {
    if (c.suspended) continue;
    const at = availableAt(c, nextDayNew);
    if (at > now.getTime() && (best === null || at < best)) best = at;
  }
  return best;
}

/** texto corto para "el próximo repaso llega …" */
export function formatNextAt(at: number, now = new Date()): string {
  if (at >= startOfTomorrow(now) && at < startOfTomorrow(now) + DAY && at === startOfDay(new Date(at))) return 'mañana';
  return `en ${formatInterval(at - now.getTime())}`;
}

/**
 * Cola de repaso: tarjetas vencidas (hasta `reviewCap`) y nuevas. Las vencidas van
 * primero, las más atrasadas antes. Las suspendidas no entran. De cada palabra sale
 * como mucho una tarjeta al día (las hermanas se "entierran" hasta mañana), salvo las
 * que están en pasos de aprendizaje, que hay que terminar hoy.
 */
export async function buildReviewQueue(
  langId: string,
  opts: QueueOptions,
  now = new Date(),
  database: LingoDB = db,
): Promise<CardRow[]> {
  const seen: NewSeen = typeof opts.seen === 'number' ? { words: opts.seen, extra: 0, terms: new Set() } : opts.seen;
  const nextDay = opts.nextDayNew ?? false;
  const t = now.getTime();
  const due = (
    await database.cards
      .where('[langId+due]')
      .between([langId, 0], [langId, startOfTomorrow(now)], true, false)
      .toArray()
  ).filter((c) => !c.suspended && availableAt(c, nextDay) <= t);
  const taken = new Set<string>();
  const out: CardRow[] = [];
  const take = (c: CardRow, bury: boolean) => {
    if (bury && (taken.has(c.termId) || (seen.terms.has(c.termId) && !inSteps(c)))) return false;
    taken.add(c.termId);
    out.push(c);
    return true;
  };

  // 1) pasos de aprendizaje pendientes: siempre
  due.filter(inSteps).forEach((c) => take(c, false));
  // 2) repasos vencidos
  let reviews = 0;
  for (const c of due.filter((x) => x.state === State.Review).sort((a, b) => a.due - b.due)) {
    if (reviews >= opts.reviewCap) break;
    if (take(c, true)) reviews++;
  }
  // 3) palabras nuevas y 4) hermanas nuevas, cada una con su cupo diario
  // (con `nextDayNew` las palabras de lecciones de días anteriores entran todas)
  const fresh = due.filter((c) => c.state === State.New).sort((a, b) => a.createdAt - b.createdAt);
  let words = nextDay ? Infinity : Math.max(0, opts.newPerDay - seen.words);
  let extra = Math.max(0, opts.newPerDay - seen.extra);
  for (const c of fresh) {
    if (kindOf(c) === 'recog') {
      if (words > 0 && take(c, true)) words--;
    } else if (extra > 0 && take(c, true)) extra--;
  }
  return out;
}

/** mezcla Fisher-Yates (no muta la entrada) */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Repaso libre: todas las tarjetas (no apartadas) de los términos elegidos, mezcladas,
 * estén o no vencidas.
 */
export async function buildFreeQueue(
  langId: string,
  termIds: Set<string>,
  database: LingoDB = db,
  random: () => number = Math.random,
): Promise<CardRow[]> {
  const cards = await database.cards.where('langId').equals(langId).toArray();
  return shuffled(
    cards.filter((c) => !c.suspended && termIds.has(c.termId)),
    random,
  );
}

/**
 * Calificación en repaso libre. Si la tarjeta ya tocaba hoy, cuenta como un repaso
 * normal. Si no, es práctica: no cambia su programación (así no se adelanta ni se
 * retrasa la memoria), salvo que la falles: entonces vuelve a salir mañana.
 */
export async function gradeFree(
  id: string,
  grade: Grade,
  elapsedMs: number,
  now = new Date(),
  database: LingoDB = db,
  opts: GradeOptions & { nextDayNew?: boolean } = {},
): Promise<GradeResult & { counted: boolean }> {
  const row = await database.cards.get(id);
  if (!row) throw new Error(`Tarjeta inexistente: ${id}`);
  if (availableAt(row, opts.nextDayNew) <= now.getTime())
    return { ...(await gradeCard(id, grade, elapsedMs, now, database, opts)), counted: true };

  const tomorrow = startOfTomorrow(now);
  const pull = grade === Rating.Again && row.state !== State.New && row.due > tomorrow;
  const next: CardRow = pull
    ? { ...row, due: tomorrow, scheduled_days: Math.max(1, Math.round((tomorrow - (row.last_review ?? tomorrow)) / DAY)) }
    : row;
  const activity: Activity = {
    xp: grade === Rating.Again ? 1 : 2,
    ms: Math.min(elapsedMs, 60_000),
    reviews: 0,
    answered: 1,
    correct: grade === Rating.Again ? 0 : 1,
  };
  await database.transaction('rw', [database.cards, database.dailyStats], async () => {
    if (pull) await database.cards.put(next);
    await recordActivity(row.langId, activity, now, database);
  });
  return {
    card: rowToCard(next),
    leech: false,
    counted: false,
    undo: { prev: row, logId: -1, activity, at: now.getTime(), siblings: [] },
  };
}

/** previsión de repasos para los próximos `days` días */
export async function forecast(langId: string, days = 14, now = new Date(), database: LingoDB = db) {
  const cards = await database.cards.where('langId').equals(langId).toArray();
  const start = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({ day: i, count: 0 }));
  for (const c of cards) {
    if (c.state === State.New || c.suspended) continue;
    const idx = Math.max(0, Math.floor((c.due - start) / 86_400_000));
    if (idx < days) buckets[idx].count++;
  }
  return buckets;
}

export const isKnown = (c: CardRow) => c.state === State.Review && c.stability >= KNOWN_STABILITY_DAYS;

export interface Coverage {
  total: number;
  /** con tarjeta en el mazo */
  inDeck: number;
  /** memoria estable (ver KNOWN_STABILITY_DAYS) */
  known: number;
}

/** cuántas de `termIds` están en el mazo y cuántas se saben ya */
export function coverageOf(termIds: string[], deck: Map<string, CardRow>): Coverage {
  let inDeck = 0;
  let known = 0;
  for (const id of termIds) {
    const c = deck.get(id);
    if (!c) continue;
    inDeck++;
    if (isKnown(c)) known++;
  }
  return { total: termIds.length, inDeck, known };
}
