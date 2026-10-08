import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/** botón de icono con área táctil de 44px y etiqueta accesible obligatoria */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-sunken',
        className,
      )}
      {...props}
    />
  );
});
