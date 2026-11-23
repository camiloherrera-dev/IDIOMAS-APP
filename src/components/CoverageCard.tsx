import type { LevelCoverage } from '@/hooks/useCoverage';

/** barras de cobertura del vocabulario oficial por nivel: sabidas (color pleno) y en el mazo (color suave) */
export function CoverageCard({ rows, title = 'Vocabulario por nivel' }: { rows: LevelCoverage[]; title?: string }) {
  if (!rows.length) return null;
  return (
    <section className="card p-5" aria-labelledby="cov-h">
      <h2 id="cov-h" className="font-bold tracking-tight">
        {title}
      </h2>
      <p className="text-sm text-ink-3">Sabidas son las que tu memoria ya sostiene tres semanas o más.</p>
      <ul className="mt-4 grid gap-3.5">
        {rows.map((r) => {
          const known = r.total ? (r.known / r.total) * 100 : 0;
          const deck = r.total ? (r.inDeck / r.total) * 100 : 0;
          return (
            <li key={r.level}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{r.label}</span>
                <span className="text-ink-2 tabular-nums">
                  {r.known} sabidas · {r.inDeck} en el mazo · {r.total}
                </span>
              </div>
              <div
                className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken"
                role="img"
                aria-label={`${r.label}: ${r.known} de ${r.total} palabras sabidas, ${r.inDeck} en el mazo`}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent-soft" style={{ width: `${deck}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${known}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
