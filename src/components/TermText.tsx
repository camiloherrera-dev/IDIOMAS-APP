import type { LanguagePack, Term } from '@/core/types';
import { cn } from './ui/cn';

const SIZES = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
} as const;

/** muestra un término con el renderizador propio del idioma si lo tiene (p. ej. hanzi + pinyin) */
export function TermText({
  lang,
  term,
  size = 'md',
  showReading = true,
  className,
}: {
  lang: LanguagePack;
  term: Pick<Term, 'term' | 'reading'>;
  size?: keyof typeof SIZES;
  showReading?: boolean;
  className?: string;
}) {
  if (lang.renderTerm) {
    const Render = lang.renderTerm;
    return (
      <span lang={lang.locale} className={className}>
        <Render term={term} size={size} showReading={showReading} />
      </span>
    );
  }
  return (
    <span lang={lang.locale} className={cn('font-semibold tracking-tight', SIZES[size], className)}>
      {term.term}
    </span>
  );
}
