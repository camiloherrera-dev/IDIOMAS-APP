import { CaretRight, MagnifyingGlass, Wrench } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { ContentError } from '../ContentError';

export function GuidesPage() {
  const { lang, profile, content, error } = useActiveLanguage();
  const [q, setQ] = useState('');

  if (error) return <ContentError message={error} />;
  if (!lang || !profile || !content) return <ScreenSkeleton />;

  const query = q.trim().toLowerCase();
  const guides = content.guides.filter((g) => !query || `${g.title} ${g.summary} ${g.body}`.toLowerCase().includes(query));

  return (
    <div>
      <PageHeader title="Guías" right={<LanguageSwitcher lang={lang} profile={profile} />} />

      <div className="px-5">
        {lang.tools && lang.tools.length > 0 && !query && (
          <section aria-labelledby="tools-h" className="mt-3">
            <h2 id="tools-h" className="sr-only">
              Herramientas
            </h2>
            <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
              {lang.tools.map((t) => (
                <Link
                  key={t.id}
                  to={`/herramientas/${t.id}`}
                  className="pressable flex w-[13.5rem] shrink-0 snap-start flex-col gap-3 rounded-[var(--radius-card)] bg-accent-soft p-4"
                >
                  <Wrench size={22} weight="fill" className="text-accent" />
                  <span>
                    <span className="block font-bold tracking-tight">{t.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-ink-2">{t.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <label className="relative mt-6 block">
          <span className="sr-only">Buscar en las guías</span>
          <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un tema"
            className="h-12 w-full rounded-[var(--radius-control)] bg-surface pr-4 pl-11 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
          />
        </label>

        <ul className="card mt-4 divide-y divide-line overflow-hidden">
          {guides.map((g) => (
            <li key={g.id}>
              <Link
                to={`/guias/${g.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-sunken active:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{g.title}</span>
                    {g.level && (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.7rem] font-semibold text-ink-3">{g.level}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-3">{g.summary}</span>
                </span>
                <CaretRight size={18} weight="bold" className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
          {guides.length === 0 && <li className="px-4 py-10 text-center text-ink-2">Ninguna guía menciona «{q}».</li>}
        </ul>
      </div>
    </div>
  );
}
