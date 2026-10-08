import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { cn } from './cn';

/** control segmentado tipo iOS */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-[0.9rem] bg-sunken p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative min-h-10 flex-1 shrink-0 rounded-[0.7rem] px-3 text-sm font-semibold whitespace-nowrap transition-colors',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[0.7rem] bg-surface shadow-[var(--shadow-card)]"
                transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0.1 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
