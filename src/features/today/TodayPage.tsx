import { Barbell, CaretRight, Cards, Flag, Flame, GraduationCap, Snowflake, Target, type Icon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, useReducedMotion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { flattenLessons, levelsOf, nextLesson } from '@/core/lessons';
import { weakSkills } from '@/core/skills';
import { useCoverage } from '@/hooks/useCoverage';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useStudyState } from '@/hooks/useStudyState';
import { InstallBanner } from '@/app/InstallBanner';
import { ContentError } from '../ContentError';

function greeting(name: string) {
  const h = new Date().getHours();
  const base = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return name ? `${base}, ${name}` : base;
}

export function TodayPage() {
  const { lang, profile, content, error } = useActiveLanguage();
  const state = useStudyState(lang?.id, profile);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const weak = useLiveQuery(() => (lang ? weakSkills(lang.id) : []), [lang?.id]);
  const coverage = useCoverage(lang, content);

  if (error) return <ContentError message={error} />;
  if (!profile || !lang || !content || !state) return <ScreenSkeleton />;

  const next = nextLesson(content, state.completed, state.lastCompletedId);
  const all = flattenLessons(content);
  const total = all.length;
  const doneCount = all.filter((r) => state.completed.has(r.lesson.id)).length;
  const weakest = weak?.find((w) => all.some((r) => r.lesson.skill === w.skill));
  const weakTitle = weakest ? (content.guides.find((g) => g.id === weakest.skill)?.title ?? weakest.skill) : undefined;

  // meta: terminar un nivel antes de una fecha → ritmo necesario
  const goalCfg = profile.goals?.[lang.id];
  const levels = levelsOf(content);
  const goalIdx = goalCfg ? levels.indexOf(goalCfg.level) : -1;
  const pace = (() => {
    if (!goalCfg || goalIdx < 0) return undefined;
    const left = all.filter((r) => levels.indexOf(r.lesson.level) <= goalIdx && !state.completed.has(r.lesson.id)).length;
    const days = Math.ceil((new Date(`${goalCfg.date}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    const cov = coverage?.find((c) => c.level === goalCfg.level);
    const name = lang.levels.find((l) => l.id === goalCfg.level)?.name ?? goalCfg.level;
    const when = new Date(`${goalCfg.date}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    return { left, days, perDay: days > 0 ? Math.ceil(left / days) : left, cov, name, when };
  })();
  const goal = profile.dailyGoalXp;
  const goalMet = state.todayXp >= goal;
  const unit = next ? content.units[next.unitIndex] : undefined;

  const primary =
    state.dueCount > 0
      ? { label: `Repasar ${state.dueCount} ${state.dueCount === 1 ? 'tarjeta' : 'tarjetas'}`, to: '/repasar' }
      : next
        ? {
            label: doneCount === 0 ? 'Empezar la primera lección' : 'Continuar la ruta',
            to: `/leccion/${next.lesson.id}`,
          }
        : { label: 'Práctica libre', to: '/practica' };

  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, transform: 'translateY(6px)' },
          animate: { opacity: 1, transform: 'translateY(0px)' },
          transition: { duration: 0.22, delay: i * 0.03, ease: [0.23, 1, 0.32, 1] as const },
        };

  return (
    <div>
      <header className="pt-safe flex items-center justify-between gap-3 px-5 pb-1">
        <LanguageSwitcher lang={lang} profile={profile} />
        <div
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-full px-3.5 font-bold tabular-nums',
            state.streak.current > 0 ? 'bg-surface hairline' : 'text-ink-3',
          )}
          aria-label={`Racha de ${state.streak.current} días`}
        >
          <Flame size={20} weight="fill" className={state.streak.activeToday ? 'text-[oklch(0.68_0.19_45)]' : 'text-ink-3'} />
          {state.streak.current}
        </div>
      </header>

      <div className="px-5">
        <motion.h1 {...enter(0)} className="pt-5 text-[2rem] leading-[1.1] font-bold tracking-tight text-balance">
          {greeting(profile.name)}
        </motion.h1>

        <motion.section {...enter(1)} className="card mt-6 p-5" aria-label="Meta diaria">
          <div className="flex items-center gap-5">
            <ProgressRing value={state.todayXp / goal} size={84} stroke={9}>
              <span className="text-lg font-bold tabular-nums">{Math.min(100, Math.round((state.todayXp / goal) * 100))}%</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-3">Meta de hoy</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {state.todayXp} <span className="text-ink-3">/ {goal} XP</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-2">
                {goalMet
                  ? 'Meta cumplida. Lo que sumes ahora es extra.'
                  : `Te faltan ${goal - state.todayXp} XP, unos ${Math.max(1, Math.ceil((goal - state.todayXp) / 12))} minutos.`}
              </p>
            </div>
          </div>
          {state.streak.frozenDays.length > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
              <Snowflake size={16} weight="bold" className="text-accent" />
              El congelador de esta semana salvó tu racha.
            </p>
          )}
          <Button size="lg" className="mt-5" onClick={() => navigate(primary.to)}>
            {primary.label}
          </Button>
        </motion.section>

        <motion.ul {...enter(2)} className="card mt-4 divide-y divide-line overflow-hidden">
          {next && unit && (
            <Row
              to={`/leccion/${next.lesson.id}`}
              icon={GraduationCap}
              title={next.lesson.title}
              detail={`Siguiente lección · ${unit.title}`}
            />
          )}
          {!next && <Row to="/ruta" icon={GraduationCap} title="Ruta completada" detail={`Terminaste las ${total} lecciones`} />}
          {pace && (
            <Row
              to="/ruta"
              icon={Flag}
              title={
                pace.left === 0
                  ? `Meta ${pace.name} cumplida`
                  : pace.days > 0
                    ? `${pace.perDay} ${pace.perDay === 1 ? 'lección' : 'lecciones'} al día para ${pace.name}`
                    : `Meta ${pace.name}: quedan ${pace.left} lecciones`
              }
              detail={`${pace.days > 0 ? `Faltan ${pace.days} días (${pace.when})` : `La fecha era el ${pace.when}`} · quedan ${pace.left}${
                pace.cov ? ` · sabes ${pace.cov.known} de ${pace.cov.total} palabras` : ''
              }`}
            />
          )}
          {weakest && weakTitle && (
            <Row
              to={`/refuerzo/${weakest.skill}`}
              icon={Target}
              title={`Refuerza: ${weakTitle}`}
              detail={
                weakest.total === 0
                  ? 'Lo marcaste como punto débil. 10 ejercicios para fijarlo.'
                  : `Lo fallaste ${weakest.wrong} veces. 10 ejercicios para fijarlo.`
              }
            />
          )}
          <Row
            to="/repasar"
            icon={Cards}
            title={state.dueCount > 0 ? `${state.dueCount} por repasar` : 'Repasos al día'}
            detail={`${state.deckSize} ${state.deckSize === 1 ? 'palabra' : 'palabras'} en tu mazo`}
          />
          <Row
            to="/practica"
            icon={Barbell}
            title="Práctica rápida"
            detail={state.deckSize >= 4 ? 'Ejercicios con lo que ya sabes' : 'Disponible cuando tengas 4 palabras'}
            disabled={state.deckSize < 4}
          />
        </motion.ul>

        <InstallBanner />

        <motion.p {...enter(3)} className="mt-6 px-1 text-sm text-ink-3">
          Llevas {doneCount} de {total} lecciones de {lang.name.toLowerCase()}.
        </motion.p>
      </div>
    </div>
  );
}

function Row({
  to,
  icon: RowIcon,
  title,
  detail,
  disabled,
}: {
  to: string;
  icon: Icon;
  title: string;
  detail: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-[0.85rem]',
          disabled ? 'bg-sunken text-ink-3' : 'bg-accent-soft text-accent',
        )}
      >
        <RowIcon size={22} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold', disabled && 'text-ink-3')}>{title}</span>
        <span className="block truncate text-sm text-ink-3">{detail}</span>
      </span>
      {!disabled && <CaretRight size={18} weight="bold" className="text-ink-3" />}
    </>
  );
  return (
    <li>
      {disabled ? (
        <div className="flex items-center gap-3.5 px-4 py-3.5" aria-disabled>
          {inner}
        </div>
      ) : (
        <Link to={to} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-sunken active:bg-sunken">
          {inner}
        </Link>
      )}
    </li>
  );
}
