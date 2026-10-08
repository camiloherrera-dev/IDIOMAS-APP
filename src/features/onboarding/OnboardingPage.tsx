import { ArrowLeft, Check, Export, PlusSquare } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LangBadge } from '@/components/LangBadge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import { db, DEFAULT_PROFILE, requestPersistence } from '@/db';
import { languages } from '@/languages';
import { isIOS, isStandalone } from '@/app/InstallBanner';

const GOALS = [
  { xp: 20, label: 'Suave', detail: 'Unos 2 minutos al día' },
  { xp: 30, label: 'Normal', detail: 'Unos 5 minutos al día' },
  { xp: 50, label: 'Serio', detail: 'Unos 10 minutos al día' },
  { xp: 80, label: 'Intenso', detail: '15 minutos o más' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const showInstall = isIOS() && !isStandalone();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [goal, setGoal] = useState(30);
  const steps = showInstall ? 4 : 3;

  const finish = async () => {
    await db.profile.put({
      ...DEFAULT_PROFILE,
      name: name.trim(),
      langs,
      activeLang: langs[0],
      dailyGoalXp: goal,
      onboarded: true,
      createdAt: Date.now(),
    });
    void requestPersistence();
    navigate('/', { replace: true });
  };

  const next = () => (step + 1 < steps ? setStep(step + 1) : void finish());
  const canNext = step === 1 ? langs.length > 0 : true;

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5">
      <div className="flex h-12 items-center gap-3">
        {step > 0 ? (
          <IconButton label="Atrás" onClick={() => setStep(step - 1)} className="-ml-2">
            <ArrowLeft size={22} weight="bold" />
          </IconButton>
        ) : (
          <span className="w-9" />
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Paso ${step + 1} de ${steps}`} role="img">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-accent' : 'bg-line')}
            />
          ))}
        </div>
        <span className="w-9" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex flex-1 flex-col pt-10"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateX(20px)' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, transform: 'translateX(0px)' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateX(-12px)', transition: { duration: 0.12 } }}
          transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
        >
          {step === 0 && (
            <>
              <h1 className="text-[2.5rem] leading-[1.05] font-bold tracking-tight text-balance">Aprende un poco cada día.</h1>
              <p className="mt-4 max-w-[34ch] text-lg text-ink-2">
                Lecciones cortas, repaso espaciado y práctica para escuchar, escribir y hablar. Funciona sin internet.
              </p>
              <label className="mt-10 flex flex-col gap-2">
                <span className="text-sm font-medium text-ink-2">¿Cómo te llamas? (opcional)</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="given-name"
                  enterKeyHint="next"
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  className="h-14 rounded-[var(--radius-control)] bg-surface px-4 text-lg text-ink outline-none hairline focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
                />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[2rem] leading-tight font-bold tracking-tight">¿Qué quieres aprender?</h1>
              <p className="mt-2 text-ink-2">Puedes elegir los dos y cambiar con un toque.</p>
              <div className="mt-8 grid gap-3">
                {languages.map((l) => {
                  const on = langs.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setLangs(on ? langs.filter((x) => x !== l.id) : [...langs, l.id])}
                      className={cn(
                        'pressable flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 text-left',
                        on ? 'shadow-[inset_0_0_0_2px_var(--c-ink)]' : 'hairline',
                      )}
                    >
                      <LangBadge lang={l} size="lg" />
                      <span className="flex-1">
                        <span className="block text-lg font-bold">{l.name}</span>
                        <span lang={l.locale} className="block text-ink-3">
                          {l.nativeName} · {l.levels[0].name}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full',
                          on ? 'bg-ink text-bg' : 'bg-sunken',
                        )}
                      >
                        {on && <Check size={16} weight="bold" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Tu meta diaria</h1>
              <p className="mt-2 text-ink-2">Lo importante es la constancia. Puedes cambiarla luego.</p>
              <div className="mt-8 grid gap-2.5" role="radiogroup" aria-label="Meta diaria">
                {GOALS.map((g) => (
                  <button
                    key={g.xp}
                    type="button"
                    role="radio"
                    aria-checked={goal === g.xp}
                    onClick={() => setGoal(g.xp)}
                    className={cn(
                      'pressable flex items-center justify-between rounded-[var(--radius-control)] bg-surface px-4 py-4 text-left',
                      goal === g.xp ? 'shadow-[inset_0_0_0_2px_var(--c-ink)]' : 'hairline',
                    )}
                  >
                    <span>
                      <span className="block font-bold">{g.label}</span>
                      <span className="block text-sm text-ink-3">{g.detail}</span>
                    </span>
                    <span className="text-sm font-semibold text-ink-2 tabular-nums">{g.xp} XP</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Instálala en tu iPhone</h1>
              <p className="mt-2 text-ink-2">
                Así se abre a pantalla completa, funciona sin internet y Safari no borra tu progreso.
              </p>
              <ol className="mt-8 grid gap-3">
                <li className="card flex items-center gap-4 p-4">
                  <Export size={28} weight="bold" className="shrink-0 text-accent" />
                  <span>
                    Toca <strong>Compartir</strong> en la barra de Safari.
                  </span>
                </li>
                <li className="card flex items-center gap-4 p-4">
                  <PlusSquare size={28} weight="bold" className="shrink-0 text-accent" />
                  <span>
                    Elige <strong>Agregar a inicio</strong> y confirma.
                  </span>
                </li>
              </ol>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="pt-6 pb-2">
        <Button size="lg" onClick={next} disabled={!canNext}>
          {step + 1 < steps ? 'Continuar' : 'Empezar'}
        </Button>
      </div>
    </div>
  );
}
