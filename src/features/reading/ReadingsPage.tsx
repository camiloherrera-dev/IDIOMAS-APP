import { BookOpenText, CaretRight, CheckCircle, Timer } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { buildReadingSession, readingsOf } from '@/core/lessons';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useStudyState } from '@/hooks/useStudyState';
import { completePractice } from '../session/complete';
import { SessionPlayer, type SessionSummary } from '../session/SessionPlayer';
import { SessionSummaryView } from '../session/SessionSummaryView';

/** lecturas del curso para practicar en cualquier momento, fuera de la ruta */
export function ReadingsPage() {
  const { lang, profile, content } = useActiveLanguage();
  const state = useStudyState(lang?.id, profile);
  const all = useMemo(() => (content ? readingsOf(content) : []), [content]);

  if (!lang || !content) return <ScreenSkeleton />;

  const groups = lang.levels.map((l) => ({ ...l, items: all.filter((r) => r.level === l.id) })).filter((g) => g.items.length);

  return (
    <div>
      <PageHeader title="Lecturas" />
      <div className="px-5 pb-8">
        {groups.length === 0 ? (
          <EmptyState
            icon={<BookOpenText size={28} weight="fill" />}
            title="Todavía no hay lecturas"
            body="Este idioma aún no tiene textos con preguntas."
          />
        ) : (
          <>
            <p className="mt-2 text-ink-2">
              Textos cortos con preguntas de comprensión y una tarea de escritura. Toca cualquier palabra del texto para ver qué
              significa.
            </p>
            {groups.map((g) => (
              <section key={g.id} className="mt-6" aria-labelledby={`lec-${g.id}`}>
                <h2 id={`lec-${g.id}`} className="flex items-center gap-2 font-bold tracking-tight">
                  {g.name}
                  {g.items[0].exercises.some((e) => e.seconds) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-ink-2">
                      <Timer size={12} weight="fill" /> con tiempo
                    </span>
                  )}
                </h2>
                <ul className="mt-2 grid gap-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <Link to={`/lecturas/${r.id}`} className="card pressable flex items-center gap-3.5 px-4 py-3.5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.8rem] bg-accent-soft text-accent">
                          {state?.completed.has(r.id) ? (
                            <CheckCircle size={22} weight="fill" />
                          ) : (
                            <BookOpenText size={22} weight="fill" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{r.title}</span>
                          <span className="block text-sm text-ink-3 tabular-nums">
                            {r.chars} caracteres · {r.exercises.filter((e) => e.type === 'reading').length} preguntas
                            {r.exercises.some((e) => e.type === 'compose') && ' · escritura'}
                          </span>
                        </span>
                        <CaretRight size={18} weight="bold" className="text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function ReadingSessionPage() {
  const { id = '' } = useParams();
  const { lang, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [round, setRound] = useState(0);
  const set = useMemo(() => (content ? readingsOf(content).find((r) => r.id === id) : undefined), [content, id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => (set ? buildReadingSession(set) : []), [set, round]);

  if (!lang || !content) return <ScreenSkeleton />;

  if (!set) {
    return (
      <div className="pt-safe">
        <EmptyState
          icon={<BookOpenText size={28} weight="fill" />}
          title="Esta lectura no existe"
          body="Puede que el curso haya cambiado."
          action={<Button onClick={() => navigate('/lecturas', { replace: true })}>Ver las lecturas</Button>}
        />
      </div>
    );
  }

  if (summary) {
    return (
      <SessionSummaryView
        title="Lectura terminada"
        summary={summary}
        primary={{ label: 'Otra lectura', onClick: () => navigate('/lecturas', { replace: true }) }}
        secondary={{
          label: 'Repetir esta',
          onClick: () => {
            setSummary(null);
            setRound((r) => r + 1);
          },
        }}
      />
    );
  }

  return (
    <SessionPlayer
      key={round}
      lang={lang}
      content={content}
      items={items}
      onExit={() => navigate(-1)}
      onFinish={(s) => void completePractice(lang.id, s).then(() => setSummary(s))}
    />
  );
}
