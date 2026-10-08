import { Check, X } from '@phosphor-icons/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/** barajado estable de Fisher-Yates */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

interface ChoiceProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state: ChoiceState;
  children: ReactNode;
  index?: number;
}

const STATE: Record<ChoiceState, string> = {
  idle: 'bg-surface hairline text-ink',
  selected: 'bg-accent-soft text-ink shadow-[inset_0_0_0_2px_var(--c-accent)]',
  correct: 'bg-ok-soft text-ink shadow-[inset_0_0_0_2px_var(--c-ok)]',
  wrong: 'bg-bad-soft text-ink shadow-[inset_0_0_0_2px_var(--c-bad)]',
  dim: 'bg-surface hairline text-ink-3',
};

export function ChoiceButton({ state, children, index, className, ...props }: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      className={cn(
        'pressable flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] px-4 py-3 text-left text-[1.0625rem] font-medium',
        STATE[state],
        className,
      )}
      {...props}
    >
      {index !== undefined && (
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-[0.6rem] text-xs font-bold tabular-nums',
            state === 'selected' ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-3',
            state === 'correct' && 'bg-ok text-white',
            state === 'wrong' && 'bg-bad text-white',
          )}
        >
          {state === 'correct' ? (
            <Check size={14} weight="bold" />
          ) : state === 'wrong' ? (
            <X size={14} weight="bold" />
          ) : (
            index + 1
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function ExerciseHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-[1.375rem] leading-tight font-bold tracking-tight text-ink">{children}</h2>;
}

/** heurística: ¿el texto contiene caracteres CJK? */
export const hasHan = (s: string) => /\p{Script=Han}/u.test(s);
