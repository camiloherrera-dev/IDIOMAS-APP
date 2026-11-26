import { BookOpenText, Check, Ear, Exam, LockSimple, PuzzlePiece, Repeat, Star } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/components/ui/cn';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { Segmented } from '@/components/ui/Segmented';
import { flattenLessons, isUnlocked, levelsOf, nextLesson } from '@/core/lessons';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useStudyState } from '@/hooks/useStudyState';
import { ContentError } from '../ContentError';

/** desplazamiento horizontal de cada nodo para que la ruta serpentee */
const OFFSETS = [0, 44, 64, 44, 0, -44, -64, -44];

export function PathPage() {
  const { lang, profile, content, error } = useActiveLanguage();
  const state = useStudyState(lang?.id, profile);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const currentRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(content && state);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (ready) currentRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [ready, reduce, picked]);

  if (error) return <ContentError message={error} />;
  if (!lang || !profile || !content || !state) return <ScreenSkeleton />;

  const all = flattenLessons(content);
  const current = nextLesson(content, state.completed, state.lastCompletedId);
  const currentId = current?.lesson.id;
  const guideIds = new Set(content.guides.map((g) => g.id));
  const levels = levelsOf(content);
  const level = picked ?? current?.lesson.level ?? levels[0];
  const levelName = (id: string) => lang.levels.find((l) => l.id === id)?.name ?? id;
  const levelRefs = all.filter((r) => r.lesson.level === level);
  const levelDone = levelRefs.filter((r) => state.completed.has(r.lesson.id)).length;

  return (
    <div>
      <PageHeader title="Ruta" right={<LanguageSwitcher lang={lang} profile={profile} />} />

      {levels.length > 1 && (
        <div className="px-5 pt-1">
          <Segmented
            label="Nivel"
            value={level}
            onChange={setPicked}
            options={levels.map((l) => ({ value: l, label: levelName(l) }))}
          />
          <div className="mt-3 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-ink-2 tabular-nums">
              {levelDone} de {levelRefs.length} lecciones
            </p>
            {levelDone < levelRefs.length && (
              <Link to={`/prueba/${level}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                <Exam size={16} weight="bold" />
                Ya lo sé: hacer la prueba
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-10 px-5 pb-6">
        {content.units.map((unit, ui) => {
          if (levels.length > 1 && unit.level !== level) return null;
          const refs = all.filter((r) => r.unitIndex === ui);
          const doneCount = refs.filter((r) => state.completed.has(r.lesson.id)).length;
          const guide = unit.lessons.find((l) => l.intro && guideIds.has(l.intro))?.intro;
          return (
            <section key={unit.id} aria-labelledby={`unit-${unit.id}`}>
              <div className="rounded-[var(--radius-card)] bg-accent-soft px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`unit-${unit.id}`} className="text-lg leading-snug font-bold tracking-tight">
                    {unit.title}
                  </h2>
                  <span className="shrink-0 text-sm font-semibold text-accent tabular-nums">
                    {doneCount}/{refs.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-2">{unit.description}</p>
                {guide && (
                  <Link
                    to={`/guias/${guide}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
                  >
                    <BookOpenText size={16} weight="bold" />
                    Leer la guía
                  </Link>
                )}
              </div>

              <ol className="mt-6 flex flex-col items-center gap-7">
                {refs.map((ref) => {
                  const done = state.completed.has(ref.lesson.id);
                  const unlocked = isUnlocked(ref, all, state.completed);
                  const current = ref.lesson.id === currentId;
                  const offset = OFFSETS[ref.order % OFFSETS.length];
                  return (
                    <li
                      key={ref.lesson.id}
                      style={{ transform: `translateX(${offset}px)` }}
                      className="flex flex-col items-center"
                    >
                      <div ref={current ? currentRef : undefined} className="relative">
                        {current && !reduce && (
                          <motion.span
                            aria-hidden
                            className="absolute -inset-2 rounded-full border-2 border-accent"
                            animate={{ opacity: [0.55, 0.15, 0.55] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                        <button
                          type="button"
                          disabled={!unlocked}
                          onClick={() => navigate(`/leccion/${ref.lesson.id}`)}
                          aria-label={`${ref.lesson.title}${done ? ', completada' : unlocked ? '' : ', bloqueada'}`}
                          className={cn(
                            'pressable relative flex size-[4.5rem] items-center justify-center rounded-full',
                            done && 'bg-accent text-accent-ink shadow-[0_5px_0_color-mix(in_oklab,var(--c-accent)_70%,black)]',
                            current &&
                              !done &&
                              'bg-accent text-accent-ink shadow-[0_5px_0_color-mix(in_oklab,var(--c-accent)_70%,black)]',
                            !unlocked && 'bg-sunken text-ink-3 shadow-[0_5px_0_var(--c-line)]',
                            unlocked && !done && !current && 'bg-surface text-accent shadow-[0_5px_0_var(--c-line)] hairline',
                          )}
                        >
                          {done ? (
                            <Check size={30} weight="bold" />
                          ) : unlocked ? (
                            ref.lesson.kind === 'grammar' ? (
                              <PuzzlePiece size={30} weight="fill" />
                            ) : ref.lesson.kind === 'listening' ? (
                              <Ear size={30} weight="fill" />
                            ) : ref.lesson.kind === 'reading' ? (
                              <BookOpenText size={30} weight="fill" />
                            ) : ref.lesson.kind === 'review' ? (
                              <Repeat size={30} weight="bold" />
                            ) : (
                              <Star size={30} weight="fill" />
                            )
                          ) : (
                            <LockSimple size={26} weight="fill" />
                          )}
                        </button>
                      </div>
                      <p
                        className={cn(
                          'mt-3 max-w-[11rem] text-center text-sm leading-snug font-semibold',
                          unlocked ? 'text-ink' : 'text-ink-3',
                        )}
                      >
                        {ref.lesson.title}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
