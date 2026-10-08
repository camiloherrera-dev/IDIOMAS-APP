import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { playWrong, speak } from '@/core/audio';
import { matchPairsSchema, type MatchPairsData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { ExerciseHeading, shuffle } from './shared';

interface MatchAnswer {
  mistakes: number;
}

function MatchPairs({ data, ctx, status, submit }: ExerciseProps<MatchPairsData>) {
  const { lang } = ctx;
  const reduce = useReducedMotion();
  const left = useMemo(() => shuffle(data.pairs.map((p, i) => ({ i, text: p[0] }))), [data]);
  const right = useMemo(() => shuffle(data.pairs.map((p, i) => ({ i, text: p[1] }))), [data]);
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [pickedRight, setPickedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<{ l: number; r: number } | null>(null);
  const mistakes = useRef(0);
  const locked = status === 'checked';

  const resolve = (l: number, r: number) => {
    if (l === r) {
      const next = new Set(matched).add(l);
      setMatched(next);
      setPickedLeft(null);
      setPickedRight(null);
      if (next.size === data.pairs.length) submit({ mistakes: mistakes.current } satisfies MatchAnswer);
    } else {
      mistakes.current++;
      setWrong({ l, r });
      if (ctx.prefs.sounds) playWrong();
      setTimeout(() => {
        setWrong(null);
        setPickedLeft(null);
        setPickedRight(null);
      }, 450);
    }
  };

  const pick = (side: 'l' | 'r', i: number) => {
    if (locked || wrong || matched.has(i)) return;
    if (side === 'l') {
      speak(data.pairs[i][0], lang.locale, { rate: ctx.prefs.voiceRate });
      if (pickedRight !== null) resolve(i, pickedRight);
      else setPickedLeft(pickedLeft === i ? null : i);
    } else {
      if (pickedLeft !== null) resolve(pickedLeft, i);
      else setPickedRight(pickedRight === i ? null : i);
    }
  };

  const cls = (side: 'l' | 'r', i: number) => {
    if (matched.has(i)) return 'bg-ok-soft text-ok shadow-[inset_0_0_0_1.5px_var(--c-ok)] opacity-60';
    if (wrong && ((side === 'l' && wrong.l === i) || (side === 'r' && wrong.r === i)))
      return 'bg-bad-soft text-bad shadow-[inset_0_0_0_2px_var(--c-bad)]';
    const picked = side === 'l' ? pickedLeft === i : pickedRight === i;
    return picked ? 'bg-accent-soft text-ink shadow-[inset_0_0_0_2px_var(--c-accent)]' : 'bg-surface text-ink hairline';
  };

  const shake = reduce ? {} : { x: [0, -6, 6, -4, 4, 0] };

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>Une las parejas</ExerciseHeading>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid gap-2.5" role="group" aria-label={lang.name}>
          {left.map(({ i, text }) => (
            <motion.button
              key={i}
              type="button"
              lang={lang.locale}
              disabled={matched.has(i) || locked}
              aria-pressed={pickedLeft === i}
              animate={wrong?.l === i ? shake : { x: 0 }}
              transition={{ duration: 0.35 }}
              onClick={() => pick('l', i)}
              className={cn(
                'pressable min-h-14 rounded-[var(--radius-control)] px-3 py-2.5 text-center font-semibold',
                lang.script === 'hanzi' ? 'text-xl' : 'text-[1.0625rem]',
                cls('l', i),
              )}
            >
              {text}
            </motion.button>
          ))}
        </div>
        <div className="grid gap-2.5" role="group" aria-label="Español">
          {right.map(({ i, text }) => (
            <motion.button
              key={i}
              type="button"
              disabled={matched.has(i) || locked}
              aria-pressed={pickedRight === i}
              animate={wrong?.r === i ? shake : { x: 0 }}
              transition={{ duration: 0.35 }}
              onClick={() => pick('r', i)}
              className={cn(
                'pressable min-h-14 rounded-[var(--radius-control)] px-3 py-2.5 text-center text-[1rem] font-medium',
                cls('r', i),
              )}
            >
              {text}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const matchPairsPlugin: ExercisePlugin<MatchPairsData> = {
  type: 'match-pairs',
  label: 'Emparejar',
  schema: matchPairsSchema,
  Component: MatchPairs,
  autoSubmit: true,
  check: (_data, answer) => {
    const mistakes = (answer as MatchAnswer | null)?.mistakes ?? 0;
    if (mistakes === 0) return { correct: true };
    return {
      correct: true,
      partial: true,
      feedback: mistakes === 1 ? 'Completado con 1 error.' : `Completado con ${mistakes} errores.`,
    };
  },
};
