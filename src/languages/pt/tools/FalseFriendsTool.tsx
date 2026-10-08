import { MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LanguagePack } from '@/core/types';

export interface FalseFriend {
  pt: string;
  looksLike: string;
  meaning: string;
  esEquivalent?: string;
  example: string;
  exampleTranslation: string;
}

export default function FalseFriendsTool({ lang }: { lang: LanguagePack }) {
  const [items, setItems] = useState<FalseFriend[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    void import('../content/false-friends.json').then((m) => setItems(m.default as FalseFriend[]));
  }, []);

  const query = q.trim().toLowerCase();
  const list = (items ?? []).filter((f) => !query || `${f.pt} ${f.looksLike} ${f.meaning}`.toLowerCase().includes(query));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-2">
        Se escriben casi igual que en español, pero no significan lo mismo. Son la fuente número uno de malentendidos.
      </p>
      <label className="relative block">
        <span className="sr-only">Buscar</span>
        <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar palabra"
          className="h-12 w-full rounded-[var(--radius-control)] bg-surface pr-4 pl-11 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
        />
      </label>

      {!items ? (
        <div className="space-y-3" role="status" aria-label="Cargando">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((f) => (
            <li key={f.pt} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p lang="pt-BR" className="text-xl font-bold tracking-tight">
                    {f.pt}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    Parece «{f.looksLike}», pero significa <strong className="font-semibold text-ink">{f.meaning}</strong>
                  </p>
                </div>
                <SpeakButton text={f.pt} locale={lang.locale} size="sm" />
              </div>
              <div className="mt-3 rounded-[0.8rem] bg-sunken px-3 py-2.5">
                <p lang="pt-BR" className="font-medium">
                  {f.example}
                </p>
                <p className="text-sm text-ink-2">{f.exampleTranslation}</p>
              </div>
              {f.esEquivalent && <p className="mt-2 text-sm text-ink-3">{f.esEquivalent}</p>}
            </li>
          ))}
          {list.length === 0 && <li className="py-8 text-center text-ink-2">Sin resultados para «{q}».</li>}
        </ul>
      )}
    </div>
  );
}
