import { cn } from '@/components/ui/cn';
import type { Term } from '@/core/types';

const HAN = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
} as const;
const PY = {
  sm: 'text-[0.62rem]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
} as const;

/** hanzi con pinyin encima (ruby) cuando cada carácter tiene su sílaba */
export function Hanzi({
  term,
  size = 'md',
  showReading = true,
}: {
  term: Pick<Term, 'term' | 'reading'>;
  size?: keyof typeof HAN;
  showReading?: boolean;
}) {
  const chars = [...term.term];
  const syllables = term.reading?.trim().split(/\s+/) ?? [];
  const aligned = showReading && syllables.length === chars.length && chars.every((c) => /\p{Script=Han}/u.test(c));

  if (aligned) {
    return (
      <span className={cn('font-han leading-[1.5] font-medium', HAN[size])}>
        {chars.map((c, i) => (
          <ruby key={i} className="[ruby-position:over]">
            {c}
            <rp>(</rp>
            <rt className={cn('font-sans font-medium tracking-normal text-ink-2', PY[size])}>{syllables[i]}</rt>
            <rp>)</rp>
          </ruby>
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col">
      {showReading && term.reading && <span className={cn('font-sans font-medium text-ink-2', PY[size])}>{term.reading}</span>}
      <span className={cn('font-han font-medium', HAN[size])}>{term.term}</span>
    </span>
  );
}
