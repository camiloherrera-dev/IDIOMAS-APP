import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useId, useState, type InputHTMLAttributes } from 'react';

const INPUT =
  'h-13 w-full rounded-[var(--radius-control)] bg-surface px-4 text-base text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]';

export function Field({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <input id={id} className={INPUT} {...props} />
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function PasswordField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} className={`${INPUT} pr-12`} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="pressable absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:text-ink-2"
        >
          {show ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-bad">
      {children}
    </p>
  );
}
