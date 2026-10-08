import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ok' | 'bad' | 'danger';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink shadow-[0_6px_16px_-8px_var(--c-accent)] disabled:shadow-none',
  secondary: 'bg-surface text-ink hairline',
  ghost: 'bg-transparent text-ink-2 hover:bg-sunken',
  ok: 'bg-ok text-white dark:text-[oklch(0.17_0.01_262)]',
  bad: 'bg-bad text-white dark:text-[oklch(0.17_0.01_262)]',
  danger: 'bg-bad-soft text-bad',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 px-6 text-[1.0625rem] w-full',
  md: 'h-12 px-5 text-base',
  sm: 'h-10 px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'pressable inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold tracking-[-0.005em] whitespace-nowrap',
        'disabled:bg-sunken disabled:text-ink-3 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
