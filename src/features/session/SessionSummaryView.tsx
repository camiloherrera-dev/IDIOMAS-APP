import { Lightning, Target, Timer } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { SessionSummary } from './SessionPlayer';

interface Props {
  title: string;
  subtitle?: string;
  summary: SessionSummary;
  newWords?: number;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}

export function SessionSummaryView({ title, subtitle, summary, newWords, primary, secondary }: Props) {
  const reduce = useReducedMotion();
  const accuracy = summary.answered ? Math.round((summary.correctFirstTry / summary.answered) * 100) : 100;
  const minutes = Math.max(1, Math.round(summary.ms / 60000));

  const stats: { icon: ReactNode; value: string; label: string }[] = [
    { icon: <Lightning size={20} weight="fill" />, value: `+${summary.xp}`, label: 'XP' },
    { icon: <Target size={20} weight="fill" />, value: `${accuracy}%`, label: 'Precisión' },
    { icon: <Timer size={20} weight="fill" />, value: `${minutes} min`, label: 'Tiempo' },
  ];

  return (
    <div className="pt-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-safe">
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(12px)' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        >
          <h1 className="text-[2.5rem] leading-[1.05] font-bold tracking-tight text-balance">{title}</h1>
          {subtitle && <p className="mt-3 text-lg text-ink-2">{subtitle}</p>}
        </motion.div>

        <dl className="grid grid-cols-3 gap-2.5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="card flex flex-col gap-2 px-4 py-4"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.4, delay: 0.12 + i * 0.06, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="text-accent">{s.icon}</span>
              <dd className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</dd>
              <dt className="-mt-1.5 text-sm text-ink-3">{s.label}</dt>
            </motion.div>
          ))}
        </dl>

        {newWords !== undefined && newWords > 0 && (
          <p className="rounded-[var(--radius-control)] bg-accent-soft px-4 py-3 text-ink">
            {newWords === 1 ? '1 palabra nueva entró' : `${newWords} palabras nuevas entraron`} a tu mazo de repaso.
          </p>
        )}
      </div>

      <div className="grid gap-2.5 pb-2">
        <Button size="lg" onClick={primary.onClick} autoFocus>
          {primary.label}
        </Button>
        {secondary && (
          <Button size="lg" variant="ghost" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
