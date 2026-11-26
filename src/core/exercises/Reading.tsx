import { Timer } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { readingSchema, type ReadingData } from '../schema';
import type { ExercisePlugin, ExerciseProps, Term } from '../types';
import { choiceState } from './MultipleChoice';
import { ChoiceButton, ExerciseHeading, hasHan } from './shared';

const PUNCT = /[\p{P}\p{S}\s]/gu;

interface Token {
  text: string;
  word: string;
  py?: string;
}

/** párrafos → palabras, con su pinyin si el texto lo trae */
export function readingTokens(data: Pick<ReadingData, 'text' | 'py'>): Token[][] {
  const pys = data.py?.split('\n').map((l) => l.split(' '));
  return data.text.split('\n').map((line, li) =>
    line
      .split(' ')
      .filter(Boolean)
      .map((text, i) => ({ text, word: text.replace(PUNCT, ''), py: pys?.[li]?.[i] })),
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** lectura con una pregunta de comprensión; cada palabra se puede tocar para ver qué significa */
function Reading({ data, ctx, answer, setAnswer, status, submit }: ExerciseProps<ReadingData>) {
  const { lang, content } = ctx;
  const checked = status === 'checked';
  const paragraphs = useMemo(() => readingTokens(data), [data]);
  const byWord = useMemo(() => {
    const m = new Map<string, Term>();
    for (const t of content.vocab) if (!m.has(t.term)) m.set(t.term, t);
    return m;
  }, [content]);
  const [picked, setPicked] = useState<{ p: number; i: number } | null>(null);
  const [peek, setPeek] = useState(false);
  const han = lang.script === 'hanzi';
  // sin pinyin a la vista (ajuste apagado o nivel sin pinyin) el texto va corrido, como en el examen
  const ruby = Boolean(data.py) && (ctx.prefs.showPinyin || peek);
  const spaced = !han || Boolean(data.py);

  // límite de tiempo: al agotarse se comprueba lo que haya marcado
  const [left, setLeft] = useState(data.seconds ?? 0);
  const latest = useRef({ answer, submit });
  latest.current = { answer, submit };
  useEffect(() => {
    if (!data.seconds || checked) return;
    const end = Date.now() + data.seconds * 1000;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        window.clearInterval(id);
        latest.current.submit(latest.current.answer ?? -1);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [data.seconds, checked]);

  const sel = picked ? paragraphs[picked.p]?.[picked.i] : undefined;
  const term = sel ? byWord.get(sel.word) : undefined;
  const timedOut = checked && Boolean(data.seconds) && (answer === -1 || answer === null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent">
            Lectura{data.part && data.part[1] > 1 ? ` · pregunta ${data.part[0]} de ${data.part[1]}` : ''}
          </p>
          <ExerciseHeading>{data.title}</ExerciseHeading>
        </div>
        {Boolean(data.seconds) && !checked && (
          <span
            role="timer"
            aria-label="Tiempo restante"
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums',
              left <= 10 ? 'bg-bad-soft text-bad' : 'bg-sunken text-ink-2',
            )}
          >
            <Timer size={16} weight="fill" />
            {fmt(left)}
          </span>
        )}
      </div>

      <div className="card p-4">
        <div
          lang={lang.locale}
          className={cn('grid gap-3', han ? 'font-han text-[1.3rem] leading-[1.9]' : 'text-lg leading-relaxed')}
        >
          {paragraphs.map((tokens, p) => (
            <p key={p} className={cn(ruby && 'leading-[2.6]')}>
              {tokens.map((t, i) => {
                const on = picked?.p === p && picked.i === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPicked(on ? null : { p, i })}
                    className={cn(
                      'rounded-md decoration-accent/40 decoration-dotted underline-offset-4',
                      spaced && 'mr-1.5',
                      on ? 'bg-accent-soft text-accent' : 'hover:underline',
                    )}
                  >
                    {ruby && t.py ? (
                      <ruby>
                        {t.text}
                        <rt className="font-sans text-[0.6rem] font-medium text-ink-3">{t.word ? t.py : ''}</rt>
                      </ruby>
                    ) : (
                      t.text
                    )}
                  </button>
                );
              })}
            </p>
          ))}
        </div>

        <div className="mt-3 min-h-11 border-t border-line pt-3 text-sm" aria-live="polite">
          {sel ? (
            <span className="flex items-center gap-2.5">
              <SpeakButton text={sel.word} locale={lang.locale} size="sm" />
              <span>
                <strong lang={lang.locale} className={cn('mr-2 text-base', han && 'font-han')}>
                  {sel.word}
                </strong>
                <span className="mr-2 text-ink-2">{sel.py ?? term?.reading}</span>
                <span>{term?.meaning.es ?? (sel.word ? 'nombre propio o palabra fuera de la lista' : '')}</span>
              </span>
            </span>
          ) : (
            <span className="flex flex-wrap items-center justify-between gap-2 text-ink-3">
              <span>Toca una palabra para ver qué significa.</span>
              {Boolean(data.py) && !ctx.prefs.showPinyin && (
                <button type="button" className="font-semibold text-accent" onClick={() => setPeek((v) => !v)}>
                  {peek ? 'Ocultar pinyin' : 'Ver pinyin'}
                </button>
              )}
            </span>
          )}
        </div>
        {checked && <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">{data.tr}</p>}
      </div>

      {timedOut && <p className="-mb-2 text-sm font-semibold text-bad">Se acabó el tiempo.</p>}
      <p
        lang={hasHan(data.question) ? lang.locale : 'es'}
        className={cn('font-semibold', hasHan(data.question) ? 'font-han text-xl' : 'text-lg')}
      >
        {data.question}
      </p>
      <div className="grid gap-2.5" role="group" aria-label="Opciones">
        {data.options.map((opt, i) => (
          <ChoiceButton
            key={`${i}-${opt}`}
            index={i}
            state={choiceState(i, { answer, status, data })}
            disabled={checked}
            onClick={() => setAnswer(i)}
          >
            <span lang={hasHan(opt) ? lang.locale : 'es'} className={hasHan(opt) && han ? 'font-han text-xl' : undefined}>
              {opt}
            </span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export const readingPlugin: ExercisePlugin<ReadingData> = {
  type: 'reading',
  label: 'Lectura',
  schema: readingSchema,
  Component: Reading,
  check: (data, answer) => ({
    correct: answer === data.answer,
    solution: data.options[data.answer],
    feedback: answer === -1 ? 'Se acabó el tiempo.' : undefined,
  }),
};
