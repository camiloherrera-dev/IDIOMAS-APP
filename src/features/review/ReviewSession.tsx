import { CheckCircle, X } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SpeakButton } from '@/components/SpeakButton';
import { TermText } from '@/components/TermText';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { speak } from '@/core/audio';
import { termMap } from '@/core/lessons';
import { buildReviewQueue, countNewSeenToday, gradeCard, previewIntervals, Rating, type Grade } from '@/core/srs';
import type { Term } from '@/core/types';
import { db, type CardRow } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { afterReviewSession } from '../session/complete';

const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: Rating.Again, label: 'Otra vez', tone: 'bg-bad-soft text-bad' },
  { grade: Rating.Hard, label: 'Difícil', tone: 'bg-warn-soft text-ink' },
  { grade: Rating.Good, label: 'Bien', tone: 'bg-ok-soft text-ok' },
  { grade: Rating.Easy, label: 'Fácil', tone: 'bg-accent-soft text-accent' },
];

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

export function ReviewSession() {
  const { lang, profile, content } = useActiveLanguage();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [terms, setTerms] = useState<Map<string, Term> | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    if (!lang || !profile || !content || queue) return;
    void (async () => {
      const seen = await countNewSeenToday(lang.id);
      const q = await buildReviewQueue(lang.id, {
        reviewCap: profile.reviewCap,
        newPerDay: profile.newPerDay,
        newSeenToday: seen,
      });
      setTerms(await resolveTerms(q, termMap(content)));
      setQueue(q);
      shownAt.current = Date.now();
    })();
  }, [lang, profile, content, queue]);

  const card = queue?.[index];
  const term = card ? terms?.get(card.termId) : undefined;
  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);

  const flip = () => {
    if (flipped || !card || !lang || !term) return;
    setFlipped(true);
    speak(term.term, lang.locale, { rate: profile?.voiceRate });
  };

  const grade = async (g: Grade) => {
    if (!card || busy) return;
    setBusy(true);
    const updated = await gradeCard(card.id, g, Date.now() - shownAt.current);
    setReviewed((n) => n + 1);
    // si vuelve a vencer en los próximos 20 minutos, se repite en esta sesión
    if (updated.due.getTime() - Date.now() < 20 * 60_000) {
      const fresh = await db.cards.get(card.id);
      if (fresh) setQueue((q) => (q ? [...q, fresh] : q));
    }
    setFlipped(false);
    setIndex((i) => i + 1);
    shownAt.current = Date.now();
    setBusy(false);
  };

  // atajos de teclado en escritorio: espacio voltea, 1-4 califica
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !flipped) {
        e.preventDefault();
        flip();
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        void grade(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
              ? `Repasaste ${reviewed} ${reviewed === 1 ? 'tarjeta' : 'tarjetas'}. Vuelve mañana para las siguientes.`
              : 'No tienes tarjetas pendientes ahora mismo.'
          }
          action={
            <Button size="lg" onClick={() => navigate('/', { replace: true })}>
              Ir a Hoy
            </Button>
          }
        />
      </div>
    );
  }

  if (!card) return null;
  const remaining = queue.length - index;
  const showReading = !profile?.hideReading;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
      <header className="pt-safe flex items-center justify-between px-3 pb-2">
        <IconButton label="Terminar repaso" onClick={() => navigate(-1)}>
          <X size={22} weight="bold" />
        </IconButton>
        <p className="text-sm font-semibold text-ink-2 tabular-nums" aria-live="polite">
          {remaining} {remaining === 1 ? 'restante' : 'restantes'}
        </p>
        <span className="w-11" />
      </header>

      <main className="flex flex-1 flex-col px-5 pt-2 pb-4 [perspective:1400px]">
        {!term ? (
          <div className="card flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-ink-2">
            Esta tarjeta ya no existe en el curso.
            <Button variant="secondary" onClick={() => setIndex((i) => i + 1)}>
              Saltar
            </Button>
          </div>
        ) : (
          <motion.div
            key={`${card.id}-${index}`}
            role="button"
            tabIndex={0}
            onClick={flip}
            aria-label={flipped ? 'Tarjeta, respuesta visible' : 'Tarjeta, toca para voltear'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px) rotateY(0deg)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: `translateY(0px) rotateY(${flipped ? 180 : 0}deg)` }}
            transition={{ duration: flipped ? 0.42 : 0.28, ease: [0.77, 0, 0.175, 1] }}
            className="relative flex-1 cursor-pointer text-left [transform-style:preserve-3d]"
            style={{ minHeight: '22rem' }}
          >
            {/* frente */}
            <div
              className={cn(
                'card absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 [backface-visibility:hidden]',
                reduce && flipped && 'invisible',
              )}
            >
              <TermText lang={lang} term={term} size="xl" showReading={showReading} className="text-center" />
              <p className="text-sm text-ink-3">Toca para ver el significado</p>
            </div>
            {/* reverso */}
            <div
              className={cn(
                'card absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center [backface-visibility:hidden]',
                !reduce && '[transform:rotateY(180deg)]',
                reduce && !flipped && 'invisible',
              )}
            >
              <TermText lang={lang} term={term} size="lg" />
              <SpeakButton text={term.term} locale={lang.locale} />
              <p className="text-2xl font-semibold tracking-tight">{term.meaning.es}</p>
              {term.examples[0] && (
                <div className="mt-2 max-w-full rounded-[var(--radius-control)] bg-sunken px-4 py-3">
                  <p lang={lang.locale} className="font-medium">
                    {term.examples[0].text}
                  </p>
                  <p className="text-sm text-ink-2">{term.examples[0].translation}</p>
                </div>
              )}
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
                )}
              >
                <span className="text-[0.95rem]">{label}</span>
                <span className="text-xs font-medium opacity-75 tabular-nums">{intervals?.[g]}</span>
              </button>
            ))}
          </div>
        ) : (
          <Button size="lg" onClick={flip} disabled={!term}>
            Mostrar respuesta
          </Button>
        )}
      </footer>
    </div>
  );
}
