import { BookBookmark, CaretRight, Cards, CheckCircle } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { formatInterval, State } from '@/core/srs';
import { db } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useStudyState } from '@/hooks/useStudyState';

export function ReviewHome() {
  const { lang, profile } = useActiveLanguage();
  const state = useStudyState(lang?.id, profile);
  const navigate = useNavigate();

  const stats = useLiveQuery(async () => {
    if (!lang) return undefined;
    const cards = await db.cards.where('langId').equals(lang.id).toArray();
    const now = Date.now();
    const upcoming = cards.filter((c) => c.due > now).sort((a, b) => a.due - b.due)[0];
    return {
      newCount: cards.filter((c) => c.state === State.New).length,
      learning: cards.filter((c) => c.state === State.Learning || c.state === State.Relearning).length,
      mature: cards.filter((c) => c.state === State.Review && c.scheduled_days >= 21).length,
      young: cards.filter((c) => c.state === State.Review && c.scheduled_days < 21).length,
      nextIn: upcoming ? formatInterval(upcoming.due - now) : null,
    };
  }, [lang?.id]);

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
                {stats.nextIn ? `El próximo repaso llega en ${stats.nextIn}.` : 'No hay repasos programados.'} Mientras tanto
                puedes practicar.
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
