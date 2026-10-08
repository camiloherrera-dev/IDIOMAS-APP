import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { cn } from '@/components/ui/cn';
import { normalize } from '../answer-check';
import { wordOrderSchema, type WordOrderData } from '../schema';
import type { ExercisePlugin, ExerciseProps, LanguagePack } from '../types';
import { ExerciseHeading, shuffle } from './shared';

interface Token {
  id: number;
  text: string;
}

const tokensOf = (data: WordOrderData): Token[] => [...data.words, ...data.distractors].map((text, id) => ({ id, text }));

function joinWords(words: string[], lang: LanguagePack) {
  return words.join(lang.wordSeparator);
}

function WordOrder({ data, ctx, answer, setAnswer, status }: ExerciseProps<WordOrderData>) {
  const { lang } = ctx;
  const reduce = useReducedMotion();
  const tokens = useMemo(() => tokensOf(data), [data]);
  // banco barajado una sola vez por ejercicio; evita que salga ya ordenado
  const bank = useMemo(() => {
    let s = shuffle(tokens);
    for (let i = 0; i < 4 && s.slice(0, data.words.length).every((t, k) => t.id === k); i++) s = shuffle(tokens);
    return s;
  }, [tokens, data.words.length]);

  const chosen = Array.isArray(answer) ? (answer as number[]) : [];
  const chosenSet = new Set(chosen);
  const locked = status === 'checked';

  const toggle = (id: number) => {
    if (locked) return;
    const next = chosenSet.has(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setAnswer(next.length ? next : null);
  };

  const transition = reduce ? { duration: 0 } : { type: 'spring' as const, duration: 0.32, bounce: 0.12 };
  const chip = 'pressable rounded-[0.9rem] px-3.5 py-2.5 text-[1.0625rem] font-medium';
  const big = lang.script === 'hanzi' ? 'text-xl' : '';

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>Ordena la frase</ExerciseHeading>
      <p className="text-xl font-semibold tracking-tight">{data.prompt}</p>

      <LayoutGroup>
        <div
          className="flex min-h-[7.5rem] flex-wrap content-start gap-2 rounded-[var(--radius-control)] border-b-2 border-dashed border-line pb-3"
          aria-label="Tu frase"
          role="group"
        >
          {chosen.map((id) => {
            const t = tokens[id];
            return (
              <motion.button
                layoutId={`tok-${t.id}`}
                transition={transition}
                key={t.id}
                type="button"
                lang={lang.locale}
                disabled={locked}
                onClick={() => toggle(t.id)}
                className={cn(chip, big, 'bg-surface text-ink shadow-[var(--shadow-card)] hairline')}
              >
                {t.text}
              </motion.button>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-2" aria-label="Palabras disponibles" role="group">
          {bank.map((t) =>
            chosenSet.has(t.id) ? (
              <span key={t.id} aria-hidden className={cn(chip, big, 'bg-sunken text-transparent')}>
                {t.text}
              </span>
            ) : (
              <motion.button
                layoutId={`tok-${t.id}`}
                transition={transition}
                key={t.id}
                type="button"
                lang={lang.locale}
                disabled={locked}
                onClick={() => toggle(t.id)}
                className={cn(chip, big, 'bg-surface text-ink hairline')}
              >
                {t.text}
              </motion.button>
            ),
          )}
        </div>
      </LayoutGroup>
    </div>
  );
}

export const wordOrderPlugin: ExercisePlugin<WordOrderData> = {
  type: 'word-order',
  label: 'Ordenar palabras',
  schema: wordOrderSchema,
  Component: WordOrder,
  check: (data, answer, { lang }) => {
    const tokens = tokensOf(data);
    const ids = Array.isArray(answer) ? (answer as number[]) : [];
    const given = joinWords(
      ids.map((i) => tokens[i]?.text ?? ''),
      lang,
    );
    const solution = joinWords(data.words, lang);
    const compact = (s: string) => normalize(s).replace(/\s/g, '');
    return { correct: compact(given) === compact(solution), solution };
  },
};
