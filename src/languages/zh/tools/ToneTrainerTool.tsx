import { ArrowClockwise } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { playCorrect, playWrong, speak } from '@/core/audio';
import type { LanguagePack } from '@/core/types';
import { useProfile } from '@/hooks/useProfile';
import { TONE_NAMES } from '../utils/pinyin';

interface Drill {
  set: string;
  hanzi: string;
  pinyin: string;
  tone: number;
  meaning: string;
}

export default function ToneTrainerTool({ lang }: { lang: LanguagePack }) {
  const profile = useProfile();
  const [drills, setDrills] = useState<Drill[] | null>(null);
  const [round, setRound] = useState<{ set: Drill[]; target: Drill } | null>(null);
  const [picked, setPicked] = useState<Drill | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  useEffect(() => {
    void import('../content/tone-drills.json').then((m) => setDrills(m.default as Drill[]));
  }, []);

  const sets = useMemo(() => {
    const map = new Map<string, Drill[]>();
    for (const d of drills ?? []) map.set(d.set, [...(map.get(d.set) ?? []), d]);
    return [...map.values()].filter((s) => s.length >= 2);
  }, [drills]);

  const next = useCallback(
    (play: boolean) => {
      if (!sets.length) return;
      const set = sets[Math.floor(Math.random() * sets.length)];
      const target = set[Math.floor(Math.random() * set.length)];
      setRound({ set: [...set].sort((a, b) => a.tone - b.tone), target });
      setPicked(null);
      // se llama desde un toque, así que iOS permite la voz
      if (play) speak(target.hanzi, lang.locale, { rate: (profile?.voiceRate ?? 0.9) * 0.85 });
    },
    [sets, lang.locale, profile?.voiceRate],
  );

  useEffect(() => {
    if (sets.length && !round) next(false);
  }, [sets, round, next]);

  if (!drills || !round) {
    return (
      <div className="space-y-3" role="status" aria-label="Cargando">
        <Skeleton className="h-40" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const choose = (d: Drill) => {
    if (picked) return;
    setPicked(d);
    const ok = d.tone === round.target.tone;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    if (profile?.sounds) (ok ? playCorrect : playWrong)();
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-2">Escucha la sílaba y elige el tono. Las opciones suenan casi igual: solo cambia la melodía.</p>

      <div className="card flex flex-col items-center gap-4 px-5 py-8">
        <SpeakButton text={round.target.hanzi} locale={lang.locale} size="lg" label="Escuchar la sílaba" slow />
        <p className="text-sm text-ink-3">
          {score.total > 0 ? `${score.right} de ${score.total} correctas` : 'Toca para escuchar'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {round.set.map((d) => {
          const isTarget = picked && d.tone === round.target.tone;
          const isWrong = picked === d && d.tone !== round.target.tone;
          return (
            <button
              key={`${d.hanzi}-${d.tone}`}
              type="button"
              onClick={() => choose(d)}
              disabled={Boolean(picked)}
              className={cn(
                'pressable flex flex-col items-center rounded-[var(--radius-control)] px-3 py-4',
                isTarget
                  ? 'bg-ok-soft shadow-[inset_0_0_0_2px_var(--c-ok)]'
                  : isWrong
                    ? 'bg-bad-soft shadow-[inset_0_0_0_2px_var(--c-bad)]'
                    : 'bg-surface hairline',
              )}
            >
              <span className="text-2xl font-semibold">{d.pinyin}</span>
              <span className="text-xs text-ink-3">{TONE_NAMES[d.tone]?.split(' (')[0]}</span>
              {picked && (
                <span className="mt-1 text-sm text-ink-2">
                  <span lang="zh-CN" className="font-han text-base text-ink">
                    {d.hanzi}
                  </span>{' '}
                  {d.meaning}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {picked && (
        <Button size="lg" onClick={() => next(true)}>
          <ArrowClockwise size={20} weight="bold" />
          Otra sílaba
        </Button>
      )}

      <section aria-labelledby="tonos-ref" className="mt-2">
        <h2 id="tonos-ref" className="mb-2 text-sm font-semibold text-ink-2">
          Los tonos
        </h2>
        <ul className="grid gap-1.5 text-sm text-ink-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <li key={t}>{TONE_NAMES[t]}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
