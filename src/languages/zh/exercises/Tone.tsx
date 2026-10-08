import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { ExerciseHeading } from '@/core/exercises/shared';
import type { ExercisePlugin, ExerciseProps } from '@/core/types';
import { applyTone, toneless } from '../utils/pinyin';
import { zhToneSchema, type ZhToneData } from './schemas';

const TONES = [1, 2, 3, 4, 5] as const;

function Tone({ data, ctx, answer, setAnswer, status }: ExerciseProps<ZhToneData>) {
  const picked = Array.isArray(answer) ? (answer as number[]) : data.syllables.map(() => 0);
  const chars = [...data.hanzi];

  const set = (s: number, t: number) => {
    if (status === 'checked') return;
    const next = [...picked];
    next[s] = t;
    setAnswer(next.every((x) => x > 0) ? next : next.some((x) => x > 0) ? next : null);
  };

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>¿Qué tono escuchas?</ExerciseHeading>

      <div className="flex items-center gap-4">
        <SpeakButton text={data.hanzi} locale={ctx.lang.locale} size="lg" />
        <div>
          <p lang="zh-CN" className="font-han text-5xl leading-none font-medium">
            {data.hanzi}
          </p>
          {data.meaning && <p className="mt-2 text-ink-2">{data.meaning}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {data.syllables.map((syl, s) => {
          const base = toneless(syl);
          return (
            <fieldset key={s} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-ink-2">
                {data.syllables.length > 1 ? (
                  <>
                    Sílaba {s + 1}:{' '}
                    <span lang="zh-CN" className="font-han text-ink">
                      {chars[s]}
                    </span>
                  </>
                ) : (
                  'Elige el tono'
                )}
              </legend>
              <div className="grid grid-cols-5 gap-1.5">
                {TONES.map((t) => {
                  const isPicked = picked[s] === t;
                  const isRight = status === 'checked' && data.tones[s] === t;
                  const isWrong = status === 'checked' && isPicked && data.tones[s] !== t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={status === 'checked'}
                      aria-pressed={isPicked}
                      aria-label={t === 5 ? `${base}, tono neutro` : `${applyTone(base, t)}, tono ${t}`}
                      onClick={() => set(s, t)}
                      className={cn(
                        'pressable flex h-16 flex-col items-center justify-center rounded-[var(--radius-control)] font-semibold',
                        isRight
                          ? 'bg-ok-soft shadow-[inset_0_0_0_2px_var(--c-ok)]'
                          : isWrong
                            ? 'bg-bad-soft shadow-[inset_0_0_0_2px_var(--c-bad)]'
                            : isPicked
                              ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--c-accent)]'
                              : 'bg-surface hairline',
                      )}
                    >
                      <span className="text-lg">{t === 5 ? base : applyTone(base, t)}</span>
                      <span className="text-[0.7rem] text-ink-3">{t === 5 ? 'neutro' : t}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

export const zhTonePlugin: ExercisePlugin<ZhToneData> = {
  type: 'zh-tone',
  label: 'Tonos',
  schema: zhToneSchema,
  Component: Tone,
  check: (data, answer) => {
    const picked = Array.isArray(answer) ? (answer as number[]) : [];
    const wrong = data.tones.map((t, i) => picked[i] !== t);
    const solution = data.syllables.join(' ');
    if (!wrong.some(Boolean)) return { correct: true, solution };
    const which = wrong.flatMap((w, i) => (w ? [i + 1] : []));
    return {
      correct: false,
      solution,
      feedback: data.tones.length > 1 ? `Revisa la sílaba ${which.join(' y ')}.` : undefined,
    };
  },
};
