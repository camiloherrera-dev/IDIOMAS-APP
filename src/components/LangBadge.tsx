import type { LanguagePack } from '@/core/types';
import { cn } from './ui/cn';

/** insignia del idioma con su color propio (los emojis de bandera no se ven en Windows) */
export function LangBadge({
  lang,
  size = 'md',
  className,
}: {
  lang: LanguagePack;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const s = {
    sm: 'size-7 text-[0.7rem] rounded-[0.55rem]',
    md: 'size-9 text-sm rounded-[0.7rem]',
    lg: 'size-12 text-lg rounded-[0.9rem]',
  }[size];
  return (
    <span
      aria-hidden
      lang={lang.locale}
      className={cn('inline-flex shrink-0 items-center justify-center font-bold', s, className)}
      style={{
        background: `color-mix(in oklab, ${lang.theme.accent} 16%, var(--c-surface))`,
        color: `light-dark(${lang.theme.accent}, ${lang.theme.accentDark})`,
      }}
    >
      {lang.glyph}
    </span>
  );
}
