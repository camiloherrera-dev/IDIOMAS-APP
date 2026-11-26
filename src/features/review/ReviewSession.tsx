import { ArrowCounterClockwise, CheckCircle, Ear, EyeSlash, Keyboard, SpeakerHigh, X, XCircle } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { SpeakButton } from '@/components/SpeakButton';
import { TermText } from '@/components/TermText';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { checkText } from '@/core/answer-check';
import { replayRate, SUBTITLE_AFTER } from '@/core/exercises/ListenControls';
import { hasVoiceFor, speak, ttsSupported, whenVoicesReady } from '@/core/audio';
import { termMap } from '@/core/lessons';
import {
  availableAt,
  buildFreeQueue,
  buildReviewQueue,
  DEFAULT_PACE,
  estimateMs,
  formatDuration,
  gradeCard,
  gradeFree,
  kindOf,
  newSeenToday,
  previewIntervals,
  reviewPace,
  Rating,
  setSuspended,
  undoGrade,
  type Grade,
  type UndoToken,
} from '@/core/srs';
import type { CheckResult, Term } from '@/core/types';
import { db, type CardKind, type CardRow } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { afterReviewSession } from '../session/complete';

const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: Rating.Again, label: 'Otra vez', tone: 'bg-bad-soft text-bad' },
  { grade: Rating.Hard, label: 'Difícil', tone: 'bg-warn-soft text-ink' },
  { grade: Rating.Good, label: 'Bien', tone: 'bg-ok-soft text-ok' },
  { grade: Rating.Easy, label: 'Fácil', tone: 'bg-accent-soft text-accent' },
];

const KIND_LABEL: Record<CardKind, string> = { recog: 'Reconocer', listen: 'Escuchar', produce: 'Escribir' };

/** tarjetas personalizadas (custom:<id>) no están en el contenido del paquete */
async function resolveTerms(cards: CardRow[], base: Map<string, Term>): Promise<Map<string, Term>> {
  const map = new Map(base);
  const custom = cards.filter((c) => c.termId.startsWith('custom-'));
  if (custom.length) {
    const rows = await db.customTerms.bulkGet(custom.map((c) => c.termId));
    for (const r of rows) {
      if (r)
        map.set(r.id, {
          id: r.id,
          term: r.term,
          reading: r.reading,
          meaning: { es: r.meaning },
          notes: r.notes,
          examples: [],
          tags: r.tags,
        });
    }
  }
  return map;
}

/** nota sugerida para una respuesta escrita: fallo = otra vez; con ayuda o lenta = difícil; si no, bien */
export function suggestGrade(result: CheckResult, elapsedMs: number): Grade {
  if (!result.correct) return Rating.Again;
  if (result.partial || elapsedMs > 20_000) return Rating.Hard;
  return Rating.Good;
}

/** términos de los niveles pedidos (`?niveles=HSK1,HSK2`); sin niveles, todos los del mazo */
export function termsOfLevels(terms: Iterable<Term>, levels: string[]): Set<string> | null {
  if (!levels.length) return null;
  const want = new Set(levels);
  const out = new Set<string>();
  for (const t of terms) if (t.level && want.has(t.level)) out.add(t.id);
  return out;
}

export function ReviewSession({ free = false }: { free?: boolean }) {
  const { lang, profile, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const levelsParam = params.get('niveles') ?? '';
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [terms, setTerms] = useState<Map<string, Term> | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<CheckResult | null>(null);
  const [suggested, setSuggested] = useState<Grade | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ token: UndoToken; appended: boolean } | null>(null);
  const shownAt = useRef(Date.now());
  const [pace, setPace] = useState(DEFAULT_PACE);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lang || !profile || !content || queue) return;
    void (async () => {
      let q: CardRow[];
      if (free) {
        const levels = levelsParam.split(',').filter(Boolean);
        const wanted =
          termsOfLevels(termMap(content).values(), levels) ??
          new Set((await db.cards.where('langId').equals(lang.id).toArray()).map((c) => c.termId));
        q = await buildFreeQueue(lang.id, wanted);
      } else {
        const seen = await newSeenToday(lang.id);
        q = await buildReviewQueue(lang.id, {
          reviewCap: profile.reviewCap,
          newPerDay: profile.newPerDay,
          nextDayNew: profile.nextDayNew ?? true,
          seen,
        });
      }
      setPace(await reviewPace(lang.id));
      setTerms(await resolveTerms(q, termMap(content)));
      setQueue(q);
      shownAt.current = Date.now();
    })();
  }, [lang, profile, content, queue, free, levelsParam]);

  const card = queue?.[index];
  const term = card ? terms?.get(card.termId) : undefined;
  const kind: CardKind = card ? kindOf(card) : 'recog';
  const retention = profile?.retention;
  const nextDay = profile?.nextDayNew ?? true;
  /** en repaso libre, las tarjetas que no tocaban hoy son práctica: no cambian su programación */
  const practiceOnly = free && !!card && availableAt(card, nextDay) > Date.now();
  const intervals = useMemo(
    () => (card && !practiceOnly ? previewIntervals(card, new Date(), retention) : null),
    [card, retention, practiceOnly],
  );
  const rate = profile?.voiceRate;

  // tarjeta de escuchar: suena sola al aparecer; si el navegador lo impide, se pide un toque
  const [audio, setAudio] = useState<'idle' | 'playing' | 'blocked' | 'novoice'>('idle');
  // escuchas de esta tarjeta: la segunda va más lenta y a la tercera aparece la palabra escrita
  const listens = useRef(0);
  const [subtitle, setSubtitle] = useState(false);
  const playListen = useCallback(() => {
    if (!term || !lang) return;
    if (!ttsSupported() || !hasVoiceFor(lang.locale)) return setAudio('novoice');
    setAudio('playing');
    listens.current += 1;
    if (listens.current >= SUBTITLE_AFTER) setSubtitle(true);
    speak(term.term, lang.locale, {
      rate: replayRate(rate ?? 0.9, listens.current),
      onEnd: () => setAudio((a) => (a === 'playing' ? 'idle' : a)),
      onBlocked: () => setAudio('blocked'),
    });
  }, [term, lang, rate]);

  useEffect(() => {
    if (card && term && lang && kind === 'listen' && !flipped) {
      let alive = true;
      void whenVoicesReady().then(() => {
        if (!alive) return;
        if (!ttsSupported() || !hasVoiceFor(lang.locale)) setAudio('novoice');
        else playListen();
      });
      return () => {
        alive = false;
      };
    }
    setAudio('idle');
    if (kind === 'produce' && !flipped && window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
    return undefined;
  }, [card, term, lang, kind, flipped, playListen]);

  const flip = useCallback(() => {
    if (flipped || !card || !lang || !term) return;
    setFlipped(true);
    if (kind !== 'listen') speak(term.term, lang.locale, { rate });
  }, [flipped, card, lang, term, kind, rate]);

  const submitTyped = useCallback(() => {
    if (!term || !lang || flipped || !typed.trim()) return;
    const answers = [term.term, ...(term.reading ? [term.reading] : [])];
    const r = checkText(typed, answers, lang.answerCheck, lang.normalizeAnswer);
    setTypedResult(r);
    setSuggested(suggestGrade(r, Date.now() - shownAt.current));
    setFlipped(true);
    speak(term.term, lang.locale, { rate });
  }, [term, lang, flipped, typed, rate]);

  const reset = () => {
    listens.current = 0;
    setSubtitle(false);
    setFlipped(false);
    setTyped('');
    setTypedResult(null);
    setSuggested(null);
    shownAt.current = Date.now();
  };

  const grade = useCallback(
    async (g: Grade) => {
      if (!card || busy) return;
      setBusy(true);
      const opts = { retention: profile?.retention, siblingKinds: profile?.cardKinds ?? [], nextDayNew: nextDay };
      const elapsed = Date.now() - shownAt.current;
      const res = free
        ? await gradeFree(card.id, g, elapsed, new Date(), db, opts)
        : { ...(await gradeCard(card.id, g, elapsed, new Date(), db, opts)), counted: true };
      setReviewed((n) => n + 1);
      // si vuelve a vencer en los próximos 20 minutos (o la fallaste practicando), se repite en esta sesión
      let appended = false;
      if (!res.leech && (res.card.due.getTime() - Date.now() < 20 * 60_000 || (!res.counted && g === Rating.Again))) {
        const fresh = await db.cards.get(card.id);
        if (fresh) {
          setQueue((q) => (q ? [...q, fresh] : q));
          appended = true;
        }
      }
      if (res.leech)
        toast('La apartamos por ahora', {
          description: `Fallaste «${term?.term ?? ''}» muchas veces. Está en Palabras difíciles para que le pongas un truco.`,
        });
      setUndo({ token: res.undo, appended });
      reset();
      setIndex((i) => i + 1);
      setBusy(false);
    },
    [card, busy, profile?.retention, profile?.cardKinds, term?.term, free, nextDay],
  );

  const undoLast = useCallback(async () => {
    if (!undo || busy || index === 0) return;
    setBusy(true);
    await undoGrade(undo.token);
    setQueue((q) => {
      if (!q) return q;
      const next = undo.appended ? q.slice(0, -1) : [...q];
      next[index - 1] = undo.token.prev;
      return next;
    });
    setReviewed((n) => Math.max(0, n - 1));
    setUndo(null);
    reset();
    setIndex((i) => i - 1);
    setBusy(false);
  }, [undo, busy, index]);

  const suspend = async () => {
    if (!card || busy) return;
    await setSuspended(card.id, true);
    toast('Tarjeta apartada', { description: 'No volverá a salir hasta que la reactives en Repasar.' });
    setUndo(null);
    reset();
    setIndex((i) => i + 1);
  };

  // atajos de teclado en escritorio: espacio voltea, 1-4 califica, z deshace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput = (e.target as HTMLElement).tagName === 'INPUT';
      if (inInput && !flipped) return;
      if (e.key === ' ' && !flipped && kind !== 'produce') {
        e.preventDefault();
        flip();
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        void grade(Number(e.key) as Grade);
      } else if (flipped && e.key === 'Enter' && suggested) {
        void grade(suggested);
      } else if (e.key.toLowerCase() === 'z' && !inInput) {
        void undoLast();
      } else if (e.key.toLowerCase() === 'r' && !inInput && kind === 'listen' && !flipped) {
        playListen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, kind, flip, grade, undoLast, suggested, playListen]);

  const finished = queue && index >= queue.length;
  useEffect(() => {
    if (finished && reviewed > 0) void afterReviewSession();
  }, [finished, reviewed]);

  if (!lang || !queue || !terms) return <ScreenSkeleton />;

  if (finished) {
    return (
      <div className="pt-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-5">
        <EmptyState
          icon={<CheckCircle size={28} weight="fill" />}
          title={reviewed ? 'Repaso terminado' : 'Nada que repasar'}
          body={
            reviewed
              ? free
                ? `Repasaste ${reviewed} ${reviewed === 1 ? 'tarjeta' : 'tarjetas'}. Las que fallaste saldrán también en el repaso de mañana.`
                : `Repasaste ${reviewed} ${reviewed === 1 ? 'tarjeta' : 'tarjetas'}. Vuelve mañana para las siguientes.`
              : free
                ? 'No hay tarjetas de esos niveles en tu mazo todavía.'
                : 'No tienes tarjetas pendientes ahora mismo.'
          }
          action={
            <Button size="lg" onClick={() => navigate(free ? '/repasar' : '/', { replace: true })}>
              {free ? 'Volver a Repasar' : 'Ir a Hoy'}
            </Button>
          }
        />
      </div>
    );
  }

  if (!card) return null;
  const remaining = queue.length - index;
  // en idiomas con caracteres, la lectura va en el reverso: en el frente sería una pista
  const frontReading = !lang.features.characters && !profile?.hideReading;
  const example = term?.examples[0];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
      <header className="pt-safe flex items-center justify-between gap-1 px-3 pb-2">
        <IconButton label="Terminar repaso" onClick={() => navigate(-1)}>
          <X size={22} weight="bold" />
        </IconButton>
        <p className="flex-1 text-center text-sm font-semibold text-ink-2 tabular-nums" aria-live="polite">
          {free && 'Libre · '}
          {KIND_LABEL[kind]} · {remaining} {remaining === 1 ? 'restante' : 'restantes'}
          <span className="block text-xs font-medium text-ink-3">
            unos {formatDuration(estimateMs(queue.slice(index), pace))}
          </span>
        </p>
        <IconButton label="Deshacer el último repaso" onClick={() => void undoLast()} disabled={!undo || busy}>
          <ArrowCounterClockwise size={20} weight="bold" className={undo ? '' : 'opacity-30'} />
        </IconButton>
        <IconButton label="Apartar esta tarjeta" onClick={() => void suspend()} disabled={!term}>
          <EyeSlash size={20} weight="bold" />
        </IconButton>
      </header>

      <main className="flex flex-1 flex-col px-5 pt-2 pb-4 [perspective:1400px]">
        {!term ? (
          <div className="card flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-ink-2">
            Esta tarjeta ya no existe en el curso.
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                setIndex((i) => i + 1);
              }}
            >
              Saltar
            </Button>
          </div>
        ) : (
          <motion.div
            key={`${card.id}-${index}`}
            role={kind === 'produce' ? undefined : 'button'}
            tabIndex={kind === 'produce' ? undefined : 0}
            onClick={kind === 'produce' ? undefined : flip}
            aria-label={kind === 'produce' ? undefined : flipped ? 'Tarjeta, respuesta visible' : 'Tarjeta, toca para voltear'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px) rotateY(0deg)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: `translateY(0px) rotateY(${flipped ? 180 : 0}deg)` }}
            transition={{ duration: flipped ? 0.42 : 0.28, ease: [0.77, 0, 0.175, 1] }}
            className={cn('relative flex-1 text-left [transform-style:preserve-3d]', kind !== 'produce' && 'cursor-pointer')}
            style={{ minHeight: '22rem' }}
          >
            {/* frente */}
            <div
              className={cn(
                'card absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 text-center [backface-visibility:hidden]',
                (reduce || kind === 'produce') && flipped && 'invisible',
              )}
            >
              {kind === 'recog' && (
                <>
                  <TermText lang={lang} term={term} size="xl" showReading={frontReading} className="text-center" />
                  <p className="text-sm text-ink-3">Toca para ver el significado</p>
                </>
              )}
              {kind === 'listen' && audio !== 'novoice' && (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-ink-2">
                    <Ear size={24} weight="fill" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playListen();
                    }}
                    aria-label={audio === 'blocked' ? 'Toca para escuchar' : 'Escuchar de nuevo'}
                    className={cn(
                      'pressable inline-flex size-20 items-center justify-center rounded-full',
                      audio === 'blocked' ? 'animate-pulse bg-accent text-accent-ink shadow-lg' : 'bg-accent-soft text-accent',
                      audio === 'playing' && 'ring-4 ring-accent/30',
                    )}
                  >
                    <SpeakerHigh size={38} weight="fill" />
                  </button>
                  <p className="text-sm text-ink-3">
                    {audio === 'blocked'
                      ? 'Toca el altavoz para escuchar. Si no suena, revisa el volumen y que el teléfono no esté en silencio.'
                      : 'Escucha y recuerda qué significa. Toca la tarjeta para comprobar.'}
                  </p>
                  {subtitle && (
                    <p
                      lang={lang.locale}
                      className={cn('text-2xl font-semibold', lang.script === 'hanzi' && 'font-han')}
                      data-testid="subtitulo"
                    >
                      {term.term}
                    </p>
                  )}
                  <p className="hidden text-xs text-ink-3 pointer-fine:block">R repite · Espacio muestra la respuesta</p>
                </>
              )}
              {kind === 'listen' && audio === 'novoice' && (
                <>
                  <TermText lang={lang} term={term} size="xl" showReading={false} className="text-center" />
                  <p className="max-w-[34ch] text-sm text-ink-3">
                    Este dispositivo no tiene voz en {lang.name.toLowerCase()}, así que la tarjeta de escuchar se muestra escrita.
                    Instala una voz en los ajustes del sistema (en iPhone: Ajustes → Accesibilidad → Contenido leído → Voces).
                  </p>
                </>
              )}
              {kind === 'produce' && (
                <form
                  className="flex w-full flex-col items-center gap-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitTyped();
                  }}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-ink-2">
                    <Keyboard size={24} weight="fill" />
                  </span>
                  <p className="text-2xl font-semibold tracking-tight text-balance">{term.meaning.es}</p>
                  <label className="flex w-full flex-col gap-2 text-left">
                    <span className="text-sm font-medium text-ink-2">Escríbela en {lang.name.toLowerCase()}</span>
                    <input
                      ref={inputRef}
                      lang={lang.locale}
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      className="w-full rounded-[var(--radius-control)] bg-surface px-4 py-3.5 text-[1.125rem] text-ink outline-none hairline focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
                    />
                    {lang.features.romanization === 'pinyin' && (
                      <span className="text-sm text-ink-3">Hanzi o pinyin con números (ni3 hao3)</span>
                    )}
                  </label>
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" onClick={flip}>
                      No la sé
                    </Button>
                    <Button type="submit" disabled={!typed.trim()}>
                      Comprobar
                    </Button>
                  </div>
                </form>
              )}
            </div>
            {/* reverso */}
            <div
              className={cn(
                'card absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center [backface-visibility:hidden]',
                !reduce && '[transform:rotateY(180deg)]',
                (reduce || kind === 'produce') && !flipped && 'invisible',
              )}
            >
              {typedResult && (
                <p
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
                    typedResult.correct ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad',
                  )}
                >
                  {typedResult.correct ? <CheckCircle size={16} weight="fill" /> : <XCircle size={16} weight="fill" />}
                  {typedResult.correct ? (typedResult.partial ? 'Casi' : 'Correcto') : `Escribiste: ${typed}`}
                </p>
              )}
              <TermText lang={lang} term={term} size="lg" />
              <SpeakButton text={term.term} locale={lang.locale} />
              <p className="text-2xl font-semibold tracking-tight">{term.meaning.es}</p>
              {typedResult?.feedback && <p className="text-sm text-ink-2">{typedResult.feedback}</p>}
              {example && (
                <div className="mt-2 flex max-w-full items-start gap-3 rounded-[var(--radius-control)] bg-sunken px-4 py-3 text-left">
                  <SpeakButton text={example.text} locale={lang.locale} size="sm" label="Escuchar el ejemplo" />
                  <div className="min-w-0">
                    <p lang={lang.locale} className="font-medium">
                      {example.text}
                    </p>
                    <p className="text-sm text-ink-2">{example.translation}</p>
                  </div>
                </div>
              )}
              {card.note && <p className="text-sm text-ink-2">Tu truco: {card.note}</p>}
            </div>
          </motion.div>
        )}
      </main>

      <footer className="pb-safe px-5 pt-2">
        {flipped ? (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="¿Qué tal la recordaste?">
            {GRADES.map(({ grade: g, label, tone }) => (
              <button
                key={g}
                type="button"
                disabled={busy}
                onClick={() => void grade(g)}
                className={cn(
                  'pressable flex h-16 flex-col items-center justify-center rounded-[var(--radius-control)] font-semibold',
                  tone,
                  suggested === g && 'shadow-[inset_0_0_0_2px_currentColor]',
                  suggested !== null && suggested !== g && 'opacity-60',
                )}
              >
                <span className="text-[0.95rem]">{label}</span>
                <span className="text-xs font-medium opacity-75 tabular-nums">
                  {practiceOnly ? (g === Rating.Again ? 'mañana' : 'práctica') : intervals?.[g]}
                </span>
              </button>
            ))}
          </div>
        ) : kind === 'produce' ? (
          <div className="h-14" />
        ) : (
          <Button size="lg" onClick={flip} disabled={!term}>
            Mostrar respuesta
          </Button>
        )}
      </footer>
    </div>
  );
}
