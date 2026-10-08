import type { ReactNode } from 'react';

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-[32ch] text-[0.95rem] leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
