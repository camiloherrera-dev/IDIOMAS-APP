import { BookBookmark, CaretRight, Cards, CheckCircle, Shuffle } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { CoverageCard } from '@/components/CoverageCard';
import { TermText } from '@/components/TermText';
import { termMap } from '@/core/lessons';
import { useCoverage } from '@/hooks/useCoverage';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { formatNextAt, nextAvailable, setSuspended, State } from '@/core/srs';
import { db } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useStudyState } from '@/hooks/useStudyState';

export function ReviewHome() {
  const { lang, profile, content } = useActiveLanguage();
  const coverage = useCoverage(lang, content);
  const state = useStudyState(lang?.id, profile);
  const navigate = useNavigate();

  const stats = useLiveQuery(async () => {
    if (!lang) return undefined;
    const everything = await db.cards.where('langId').equals(lang.id).toArray();
    const cards = everything.filter((c) => !c.suspended);
    const now = Date.now();
    const next = nextAvailable(cards, new Date(now), profile?.nextDayNew ?? true);
    return {
      termIds: cards.map((c) => c.termId),
      newCount: cards.filter((c) => c.state === State.New).length,
      learning: cards.filter((c) => c.state === State.Learning || c.state === State.Relearning).length,
      mature: cards.filter((c) => c.state === State.Review && c.scheduled_days >= 21).length,
      young: cards.filter((c) => c.state === State.Review && c.scheduled_days < 21).length,
      nextIn: next ? formatNextAt(next, new Date(now)) : null,
      apart: everything.filter((c) => c.suspended).sort((a, b) => b.lapses - a.lapses),
    };
  }, [lang?.id, profile?.nextDayNew]);

  // repaso libre: tarjetas del mazo por nivel
  const byLevel = useMemo(() => {
    if (!stats || !content || !lang) return [];
    const terms = termMap(content);
    const counts = new Map<string, number>();
    for (const id of stats.termIds) {
      const level = terms.get(id)?.level;
      if (level) counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return lang.levels.filter((l) => counts.has(l.id)).map((l) => ({ ...l, cards: counts.get(l.id)! }));
  }, [stats, content, lang]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? byLevel.map((l) => l.id);
  const freeCount = byLevel.filter((l) => chosen.includes(l.id)).reduce((s, l) => s + l.cards, 0);

  if (!lang || !profile || !state || !stats) return <ScreenSkeleton />;

  const empty = state.deckSize === 0;

  return (
    <div>
      <PageHeader title="Repasar" right={<LanguageSwitcher lang={lang} profile={profile} />} />

      <div className="px-5">
        <section className="card mt-4 flex flex-col items-start p-6">
          <span className="flex size-12 items-center justify-center rounded-[0.9rem] bg-accent-soft text-accent">
            {state.dueCount > 0 ? <Cards size={26} weight="fill" /> : <CheckCircle size={26} weight="fill" />}
          </span>
          {empty ? (
            <>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">Tu mazo está vacío</h2>
              <p className="mt-1 text-ink-2">
                Las palabras de cada lección que completes entran aquí para repasarlas en el momento justo.
              </p>
              <Button size="lg" className="mt-6" onClick={() => navigate('/ruta')}>
                Ir a la ruta
              </Button>
            </>
          ) : state.dueCount > 0 ? (
            <>
              <h2 className="mt-4 text-2xl font-bold tracking-tight tabular-nums">
                {state.dueCount} {state.dueCount === 1 ? 'tarjeta' : 'tarjetas'} para hoy
              </h2>
              <p className="mt-1 text-ink-2">
                Unos {Math.max(1, Math.round(state.dueCount * 0.15))} minutos. Repasar justo antes de olvidar es lo que fija la
                memoria.
              </p>
              <Button size="lg" className="mt-6" onClick={() => navigate('/repasar/sesion')}>
                Empezar repaso
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">Todo al día</h2>
              <p className="mt-1 text-ink-2">
                {stats.nextIn ? `El próximo repaso llega ${stats.nextIn}.` : 'No hay repasos programados.'} Mientras tanto puedes
                practicar.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="mt-6"
                onClick={() => navigate('/practica')}
                disabled={state.deckSize < 4}
              >
                Práctica rápida
              </Button>
            </>
          )}
        </section>

        {!empty && (
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ['Nuevas', stats.newCount],
              ['Aprendiendo', stats.learning],
              ['Jóvenes', stats.young],
              ['Maduras', stats.mature],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[var(--radius-control)] bg-surface px-1 py-3 hairline">
                <dd className="text-xl font-bold tabular-nums">{v}</dd>
                <dt className="text-[0.72rem] font-medium text-ink-3">{k}</dt>
              </div>
            ))}
          </dl>
        )}

        {byLevel.length > 0 && (
          <section className="card mt-4 p-5" aria-labelledby="free-h">
            <h2 id="free-h" className="font-bold tracking-tight">
              Repaso libre
            </h2>
            <p className="text-sm text-ink-3">
              Todas las tarjetas de los niveles que elijas, mezcladas, cuando quieras. Las que no tocaban hoy no cambian su
              programación; si fallas una, vuelve mañana.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Niveles para el repaso libre">
              {byLevel.map((l) => {
                const on = chosen.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(on ? chosen.filter((x) => x !== l.id) : [...chosen, l.id])}
                    className={cn(
                      'pressable rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums',
                      on ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-2',
                    )}
                  >
                    {l.name} · {l.cards}
                  </button>
                );
              })}
            </div>
            <Button
              className="mt-4"
              variant="secondary"
              disabled={freeCount === 0}
              onClick={() => navigate(`/repasar/libre?niveles=${encodeURIComponent(chosen.join(','))}`)}
            >
              <Shuffle size={18} weight="bold" />
              Repasar {freeCount} {freeCount === 1 ? 'tarjeta' : 'tarjetas'}
            </Button>
          </section>
        )}

        {coverage && coverage.length > 0 && !empty && (
          <div className="mt-4">
            <CoverageCard rows={coverage} />
          </div>
        )}

        {stats.apart.length > 0 && (
          <section className="card mt-4 p-5" aria-labelledby="apart-h">
            <h2 id="apart-h" className="font-bold tracking-tight">
              Palabras difíciles ({stats.apart.length})
            </h2>
            <p className="text-sm text-ink-3">
              Están apartadas del repaso. Ponles un truco para recordarlas y reactívalas cuando quieras.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {stats.apart.slice(0, 40).map((c) => {
                const term = content ? termMap(content).get(c.termId) : undefined;
                return (
                  <li key={c.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        {term ? <TermText lang={lang} term={term} size="sm" /> : <span className="text-ink-3">{c.termId}</span>}
                        <span className="block text-sm text-ink-2">
                          {term?.meaning.es}
                          {c.lapses > 0 && ` · ${c.lapses} fallos`}
                        </span>
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => void setSuspended(c.id, false)}>
                        Reactivar
                      </Button>
                    </div>
                    <input
                      defaultValue={c.note ?? ''}
                      placeholder="Tu truco para recordarla"
                      aria-label={`Truco para ${term?.term ?? c.termId}`}
                      onBlur={(e) => {
                        const note = e.target.value.trim();
                        if (note !== (c.note ?? '')) void db.cards.update(c.id, { note: note || undefined });
                      }}
                      className="w-full rounded-[0.7rem] bg-sunken px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Link to="/palabras" className="card pressable mt-4 flex items-center gap-3.5 px-4 py-4">
          <span className="flex size-11 items-center justify-center rounded-[0.85rem] bg-accent-soft text-accent">
            <BookBookmark size={22} weight="fill" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Mis palabras</span>
            <span className="block text-sm text-ink-3">Diccionario, búsqueda y palabras propias</span>
          </span>
          <CaretRight size={18} weight="bold" className="text-ink-3" />
        </Link>
      </div>
    </div>
  );
}
