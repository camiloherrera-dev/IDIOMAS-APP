import { ArrowCounterClockwise, CheckCircle, Lightning, WarningCircle, X, XCircle } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { playCorrect, playWrong, stopSpeaking } from '@/core/audio';
import { getPlugin } from '@/core/exercises';
import { XP } from '@/core/gamification';
import type { SessionItem } from '@/core/lessons';
import type { CheckResult, ExerciseContext, LanguageContent, LanguagePack } from '@/core/types';
import { useProfile } from '@/hooks/useProfile';
import { IntroCard } from './IntroCard';

export interface SessionSummary {
  xp: number;
  /** ejercicios distintos respondidos */
  answered: number;
  /** acertados al primer intento */
  correctFirstTry: number;
  ms: number;
  bestCombo: number;
}

interface Props {
  lang: LanguagePack;
  content: LanguageContent;
  items: SessionItem[];
  onFinish: (summary: SessionSummary) => void;
  onExit: () => void;
}

interface QueueEntry {
  item: SessionItem;
  retry: boolean;
}

export function SessionPlayer({ lang, content, items, onFinish, onExit }: Props) {
  const profile = useProfile();
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<QueueEntry[]>(() => items.map((item) => ({ item, retry: false })));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<unknown>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const stats = useRef({ xp: 0, answered: 0, correctFirstTry: 0, combo: 0, bestCombo: 0, start: Date.now() });
  const finished = useRef(false);

  const entry = queue[pos];
  const prefs = useMemo(
    () => ({ voiceRate: profile?.voiceRate ?? 0.9, sounds: profile?.sounds ?? true }),
    [profile?.voiceRate, profile?.sounds],
  );
  const ctx: ExerciseContext = useMemo(() => ({ lang, content, prefs }), [lang, content, prefs]);

  const plugin = entry?.item.kind === 'exercise' ? getPlugin(entry.item.data.type, lang) : undefined;
  const parsed = useMemo(() => {
    if (entry?.item.kind !== 'exercise' || !plugin) return null;
    return plugin.schema.safeParse(entry.item.data);
  }, [entry, plugin]);

  const progress = items.length ? done.size / items.length : 0;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    stopSpeaking();
    const s = stats.current;
    onFinish({
      xp: s.xp,
      answered: s.answered,
      correctFirstTry: s.correctFirstTry,
      ms: Date.now() - s.start,
      bestCombo: s.bestCombo,
    });
  }, [onFinish]);

  const advance = useCallback(() => {
    setAnswer(null);
    setResult(null);
    if (pos + 1 >= queue.length) finish();
    else setPos((p) => p + 1);
  }, [pos, queue.length, finish]);

  const check = useCallback(
    (override?: unknown) => {
      if (!entry || entry.item.kind !== 'exercise' || !plugin || !parsed?.success || result) return;
      const given = override !== undefined ? override : answer;
      if (override !== undefined) setAnswer(override);
      const r = plugin.check(parsed.data, given, ctx);
      setResult(r);

      const s = stats.current;
      const key = entry.item.key;
      if (!entry.retry) s.answered++;
      if (r.correct) {
        if (!entry.retry) s.correctFirstTry++;
        s.combo++;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.xp += entry.retry ? 3 : r.partial ? XP.exercisePartial : XP.exerciseCorrect;
        if (s.combo > 0 && s.combo % XP.comboEvery === 0) s.xp += XP.comboBonus;
        setDone((d) => new Set(d).add(key));
        if (prefs.sounds) playCorrect();
      } else {
        s.combo = 0;
        if (prefs.sounds) playWrong();
        // se repite una vez al final de la sesión
        if (!entry.retry) setQueue((q) => [...q, { item: entry.item, retry: true }]);
        else setDone((d) => new Set(d).add(key));
      }
    },
    [entry, plugin, parsed, result, answer, ctx, prefs.sounds],
  );

  // Enter = comprobar / continuar (los inputs manejan su propio Enter)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || confirmExit) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        if (!result) return;
      }
      if (tag === 'BUTTON') return;
      e.preventDefault();
      if (result || entry?.item.kind === 'intro') advance();
      else if (answer !== null) check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, answer, entry, advance, check, confirmExit]);

  useEffect(() => () => stopSpeaking(), []);

  if (!entry) return null;

  const isIntro = entry.item.kind === 'intro';
  const invalid = entry.item.kind === 'exercise' && (!plugin || !parsed?.success);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-bg px-3 pb-2">
        <IconButton label="Salir de la sesión" onClick={() => (done.size > 0 ? setConfirmExit(true) : onExit())}>
          <X size={22} weight="bold" />
        </IconButton>
        <div
          className="h-3 flex-1 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label="Progreso de la sesión"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done.size}
        >
          <motion.div
            className="h-full w-full origin-left rounded-full bg-accent"
            initial={false}
            animate={{ transform: `scaleX(${Math.max(0.04, progress)})` }}
            transition={{ duration: reduce ? 0 : 0.4, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        <ComboBadge combo={stats.current.combo} />
      </header>

      <main className="flex-1 px-5 pt-4 pb-48">
        <h1 className="sr-only">Sesión de estudio</h1>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${entry.item.key}-${pos}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateX(24px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateX(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateX(-16px)', transition: { duration: 0.12 } }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            {entry.retry && (
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-sm font-semibold text-ink">
                <ArrowCounterClockwise size={14} weight="bold" />
                Repaso de un error
              </p>
            )}
            {entry.item.kind === 'intro' ? (
              <IntroCard term={entry.item.term} lang={lang} />
            ) : invalid ? (
              <div className="card flex gap-3 p-5 text-ink-2">
                <WarningCircle size={22} className="shrink-0 text-warn" />
                <p>Este ejercicio ({entry.item.data.type}) tiene un formato que la app no reconoce. Puedes saltarlo.</p>
              </div>
            ) : (
              plugin &&
              parsed?.success && (
                <plugin.Component
                  data={parsed.data}
                  ctx={ctx}
                  answer={answer}
                  setAnswer={setAnswer}
                  status={result ? 'checked' : 'answering'}
                  result={result ?? undefined}
                  submit={check}
                />
              )
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-lg">
          <AnimatePresence initial={false}>
            {result && <FeedbackPanel key="fb" result={result} reduce={Boolean(reduce)} />}
          </AnimatePresence>
          <div
            className={cn(
              'pb-safe px-5 pt-3 transition-colors duration-200',
              result ? (result.correct ? 'bg-ok-soft' : 'bg-bad-soft') : 'bg-bg',
            )}
          >
            {isIntro || invalid ? (
              <Button size="lg" onClick={advance}>
                {invalid ? 'Saltar' : 'Entendido'}
              </Button>
            ) : result ? (
              <Button size="lg" variant={result.correct ? 'ok' : 'bad'} onClick={advance} autoFocus>
                Continuar
              </Button>
            ) : plugin?.autoSubmit ? (
              <p className="flex h-14 items-center justify-center text-sm text-ink-3">Toca una palabra y luego su pareja</p>
            ) : (
              <Button size="lg" disabled={answer === null} onClick={() => check()}>
                Comprobar
              </Button>
            )}
          </div>
        </div>
      </footer>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="¿Salir de la sesión?">
        <p className="px-2 pb-5 text-ink-2">Lo que llevas de esta sesión no se guardará.</p>
        <div className="grid gap-2.5 pb-2">
          <Button size="lg" onClick={() => setConfirmExit(false)}>
            Seguir estudiando
          </Button>
          <Button size="lg" variant="danger" onClick={onExit}>
            Salir
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function FeedbackPanel({ result, reduce }: { result: CheckResult; reduce: boolean }) {
  const ok = result.correct;
  const title = ok ? (result.partial ? 'Casi perfecto' : '¡Bien hecho!') : 'No es correcto';
  const Icon = ok ? CheckCircle : XCircle;
  return (
    <motion.div
      role="status"
      aria-live="assertive"
      className={cn('px-5 pt-5', ok ? 'bg-ok-soft' : 'bg-bad-soft')}
      initial={reduce ? { opacity: 0 } : { transform: 'translateY(100%)' }}
      animate={reduce ? { opacity: 1 } : { transform: 'translateY(0%)' }}
      exit={reduce ? { opacity: 0 } : { transform: 'translateY(100%)', transition: { duration: 0.15 } }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="flex items-start gap-3">
        <Icon size={30} weight="fill" className={cn('shrink-0', ok ? 'text-ok' : 'text-bad')} />
        <div className="min-w-0">
          <p className={cn('text-lg font-bold', ok ? 'text-ok' : 'text-bad')}>{title}</p>
          {result.feedback && <p className="text-ink">{result.feedback}</p>}
          {result.solution && (!ok || result.partial) && (
            <p className="mt-1 text-ink">
              <span className="text-ink-2">Respuesta: </span>
              <strong className="font-semibold">{result.solution}</strong>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ComboBadge({ combo }: { combo: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex w-14 justify-end" aria-live="polite">
      <AnimatePresence>
        {combo >= 3 && (
          <motion.span
            key={combo}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.85)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'scale(1)' }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
            className="flex items-center gap-0.5 text-sm font-bold text-accent tabular-nums"
            aria-label={`${combo} aciertos seguidos`}
          >
            <Lightning size={16} weight="fill" />
            {combo}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
