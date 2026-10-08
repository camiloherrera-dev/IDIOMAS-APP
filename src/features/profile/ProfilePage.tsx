import { BookBookmark, CaretRight, GearSix, LockSimple, Trophy, type Icon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/components/ui/cn';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { ACHIEVEMENTS, addDays, dayKey, getStreak } from '@/core/gamification';
import { forecast } from '@/core/srs';
import { db } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';

const WEEKS = 15;
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** 0-4: nivel de intensidad del mapa de calor respecto a la meta diaria */
function level(xp: number, goal: number) {
  if (xp <= 0) return 0;
  if (xp < goal * 0.5) return 1;
  if (xp < goal) return 2;
  if (xp < goal * 2) return 3;
  return 4;
}
const LEVEL_BG = [
  'var(--c-sunken)',
  'color-mix(in oklab, var(--c-accent) 28%, var(--c-surface))',
  'color-mix(in oklab, var(--c-accent) 52%, var(--c-surface))',
  'color-mix(in oklab, var(--c-accent) 78%, var(--c-surface))',
  'var(--c-accent)',
];

export function ProfilePage() {
  const { lang, profile } = useActiveLanguage();
  const data = useLiveQuery(async () => {
    if (!lang) return undefined;
    const [stats, cards, unlocked, streak, fc] = await Promise.all([
      db.dailyStats.toArray(),
      db.cards.count(),
      db.achievements.toArray(),
      getStreak(),
      forecast(lang.id, 14),
    ]);
    const byDate = new Map<string, number>();
    for (const s of stats) byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.xp);
    const totals = stats.reduce(
      (acc, s) => ({ xp: acc.xp + s.xp, answered: acc.answered + s.answered, correct: acc.correct + s.correct }),
      { xp: 0, answered: 0, correct: 0 },
    );
    return { byDate, totals, cards, unlocked: new Map(unlocked.map((a) => [a.id, a.unlockedAt])), streak, fc };
  }, [lang?.id]);

  if (!lang || !profile || !data) return <ScreenSkeleton />;

  const accuracy = data.totals.answered ? Math.round((data.totals.correct / data.totals.answered) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Perfil"
        subtitle={profile.name || undefined}
        right={<LanguageSwitcher lang={lang} profile={profile} />}
      />

      <div className="flex flex-col gap-4 px-5">
        <dl className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat
            label="Racha"
            value={`${data.streak.current} ${data.streak.current === 1 ? 'día' : 'días'}`}
            detail={`Mejor: ${data.streak.best}`}
          />
          <Stat label="XP total" value={data.totals.xp.toLocaleString('es')} />
          <Stat label="Palabras en el mazo" value={String(data.cards)} detail="Todos los idiomas" />
          <Stat label="Precisión" value={accuracy === null ? 'Sin datos' : `${accuracy}%`} detail="Al primer intento" />
        </dl>

        <Heatmap byDate={data.byDate} goal={profile.dailyGoalXp} />
        <Forecast buckets={data.fc} />

        <section className="card p-5" aria-labelledby="logros-h">
          <h2 id="logros-h" className="font-bold tracking-tight">
            Logros
          </h2>
          <p className="text-sm text-ink-3">
            {data.unlocked.size} de {ACHIEVEMENTS.length} desbloqueados
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {ACHIEVEMENTS.map((a) => {
              const at = data.unlocked.get(a.id);
              return (
                <li key={a.id} className={cn('rounded-[var(--radius-control)] p-3', at ? 'bg-accent-soft' : 'bg-sunken')}>
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full',
                      at ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-3',
                    )}
                  >
                    {at ? <Trophy size={18} weight="fill" /> : <LockSimple size={16} weight="fill" />}
                  </span>
                  <p className={cn('mt-2 text-sm font-semibold', !at && 'text-ink-2')}>{a.title}</p>
                  <p className="text-xs leading-snug text-ink-3">{a.description}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <ul className="card mb-2 divide-y divide-line overflow-hidden">
          <LinkRow to="/palabras" icon={BookBookmark} label="Mis palabras" />
          <LinkRow to="/ajustes" icon={GearSix} label="Ajustes y datos" />
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[1.5rem] leading-tight font-bold tracking-tight tabular-nums">{value}</dd>
      {detail && <dd className="text-xs text-ink-3">{detail}</dd>}
    </div>
  );
}

function LinkRow({ to, icon: RowIcon, label }: { to: string; icon: Icon; label: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-sunken active:bg-sunken">
        <RowIcon size={22} weight="fill" className="text-accent" />
        <span className="flex-1 font-semibold">{label}</span>
        <CaretRight size={18} weight="bold" className="text-ink-3" />
      </Link>
    </li>
  );
}

function Heatmap({ byDate, goal }: { byDate: Map<string, number>; goal: number }) {
  const today = new Date();
  // empezar en el lunes de hace WEEKS-1 semanas
  const start = addDays(today, -((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
  const [hover, setHover] = useState<{ date: string; xp: number } | null>(null);
  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      const key = dayKey(date);
      return { key, xp: byDate.get(key) ?? 0, future: date > today, isToday: key === dayKey(today) };
    }),
  );
  const fmt = (key: string) =>
    new Date(`${key}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  const activeDays = [...byDate.values()].filter((x) => x > 0).length;

  return (
    <section className="card p-5" aria-labelledby="actividad-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="actividad-h" className="font-bold tracking-tight">
          Actividad
        </h2>
        <p className="text-sm text-ink-3 tabular-nums" aria-live="polite">
          {hover ? `${fmt(hover.date)}: ${hover.xp} XP` : `${activeDays} ${activeDays === 1 ? 'día' : 'días'} con estudio`}
        </p>
      </div>
      <div className="mt-4 flex gap-[3px]" onMouseLeave={() => setHover(null)}>
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[0.6rem] leading-none text-ink-3" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={d} className="flex h-full items-center">
              {i % 2 === 0 ? d : ''}
            </span>
          ))}
        </div>
        {columns.map((col, w) => (
          <div key={w} className="grid flex-1 grid-rows-7 gap-[3px]">
            {col.map((c) => (
              <button
                key={c.key}
                type="button"
                tabIndex={-1}
                disabled={c.future}
                aria-label={`${fmt(c.key)}: ${c.xp} XP`}
                onMouseEnter={() => setHover({ date: c.key, xp: c.xp })}
                onFocus={() => setHover({ date: c.key, xp: c.xp })}
                onClick={() => setHover({ date: c.key, xp: c.xp })}
                className={cn(
                  'aspect-square w-full rounded-[3px]',
                  c.isToday && 'ring-2 ring-ink/60 ring-offset-1 ring-offset-surface',
                  c.future && 'opacity-0',
                )}
                style={{ background: LEVEL_BG[level(c.xp, goal)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-ink-3" aria-hidden>
        Menos
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className="size-3 rounded-[3px]" style={{ background: bg }} />
        ))}
        Más
      </div>
    </section>
  );
}

function Forecast({ buckets }: { buckets: { day: number; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const [hover, setHover] = useState<number | null>(null);
  const label = (day: number) => (day === 0 ? 'Hoy' : day === 1 ? 'Mañana' : `En ${day} días`);

  return (
    <section className="card p-5" aria-labelledby="prevision-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="prevision-h" className="font-bold tracking-tight">
          Repasos próximos
        </h2>
        <p className="text-sm text-ink-3 tabular-nums" aria-live="polite">
          {hover !== null ? `${label(hover)}: ${buckets[hover].count}` : `${total} en 14 días`}
        </p>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-2">Cuando repases tus primeras tarjetas verás aquí cuántas vuelven cada día.</p>
      ) : (
        <>
          <div className="mt-4 flex h-28 items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)}>
            {buckets.map((b) => (
              <button
                key={b.day}
                type="button"
                aria-label={`${label(b.day)}: ${b.count} repasos`}
                onMouseEnter={() => setHover(b.day)}
                onFocus={() => setHover(b.day)}
                onClick={() => setHover(b.day)}
                className="group flex h-full flex-1 items-end"
              >
                <span
                  className={cn('w-full rounded-t-[4px] transition-opacity', hover !== null && hover !== b.day && 'opacity-50')}
                  style={{ height: b.count ? `${Math.max(4, (b.count / max) * 100)}%` : '0%', background: 'var(--c-accent)' }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-ink-3" aria-hidden>
            <span>Hoy</span>
            <span>+7</span>
            <span>+13</span>
          </div>
        </>
      )}
    </section>
  );
}
