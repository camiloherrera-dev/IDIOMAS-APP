import { cn } from './cn';

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-ink-3">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          'relative h-[1.9rem] w-[3.1rem] shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-[0.2rem] left-[0.2rem] size-6 rounded-full bg-white shadow-[0_2px_4px_oklch(0_0_0/0.2)] transition-transform duration-200 ease-[var(--ease-out)]',
            checked && 'translate-x-[1.2rem]',
          )}
        />
      </span>
    </label>
  );
}
