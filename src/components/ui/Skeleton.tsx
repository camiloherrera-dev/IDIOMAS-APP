import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-[var(--radius-control)] bg-sunken', className)} />;
}

/** esqueleto genérico de pantalla: título + bloques */
export function ScreenSkeleton() {
  return (
    <div className="space-y-4 px-5 pt-4" role="status" aria-label="Cargando">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
