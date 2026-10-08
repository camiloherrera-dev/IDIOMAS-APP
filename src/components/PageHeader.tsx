import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="pt-safe flex items-start justify-between gap-3 px-5 pb-2">
      <div className="min-w-0 pt-2">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-ink-2">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 pt-1.5">{right}</div>}
    </header>
  );
}
