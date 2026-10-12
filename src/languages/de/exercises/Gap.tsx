import { useEffect, useRef } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { checkText } from '@/core/answer-check';
import { ChoiceButton, ExerciseHeading, type ChoiceState } from '@/core/exercises/shared';
import type { CheckResult, ExerciseContext, ExercisePlugin, ExerciseProps } from '@/core/types';
import { deGapSchema, type DeGapData } from './schemas';

function optionState(opt: string, answer: unknown, status: string, answers: string[]): ChoiceState {
  if (status === 'checked') {
    if (opt === answers[0] || (opt === answer && answers.includes(opt))) return 'correct';
    if (opt === answer) return 'wrong';
    return 'dim';
  }
  return opt === answer ? 'selected' : 'idle';
}

function Gap({ data, ctx, answer, setAnswer, status, result, submit }: ExerciseProps<DeGapData>) {
  const value = typeof answer === 'string' ? answer : '';
  const checked = status === 'checked';
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!data.options && window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, [data.options]);
  const [before, after] = data.sentence.split('___');
  const full = `${before}${data.answers[0]}${after}`;

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>{data.question ?? 'Completa la frase'}</ExerciseHeading>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <p lang="de-DE" className="flex-1 text-xl leading-relaxed font-medium">
            {before}
            <span
              className={cn(
                'mx-1 inline-block min-w-16 border-b-2 text-center',
                checked && result && !result.correct
                  ? 'border-bad text-bad'
                  : checked && result?.correct
                    ? 'border-ok text-ok'
                    : value
                      ? 'border-accent text-accent'
                      : 'border-line text-ink-3',
              )}
            >
              {value || ' '}
            </span>
            {after}
          </p>
          {checked && <SpeakButton text={full} locale={ctx.lang.locale} label="Escuchar la frase" />}
        </div>
        {data.translation && <p className="text-ink-3">{data.translation}</p>}
        {data.hint && !checked && <p className="text-sm text-ink-2">Pista: {data.hint}</p>}
      </div>

      {data.options ? (
        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Opciones">
          {data.options.map((opt) => (
            <ChoiceButton
              key={opt}
              state={optionState(opt, answer, status, data.answers)}
              disabled={checked}
              onClick={() => setAnswer(opt)}
              className="justify-center text-center"
            >
              <span lang="de-DE">{opt}</span>
            </ChoiceButton>
          ))}
        </div>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-2">Tu respuesta</span>
          <input
            ref={inputRef}
            lang="de-DE"
            value={value}
            readOnly={checked}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => setAnswer(e.target.value.length ? e.target.value : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) submit();
            }}
            className={cn(
              'h-14 w-full rounded-[var(--radius-control)] bg-surface px-4 text-[1.125rem] text-ink outline-none hairline',
              'focus:shadow-[inset_0_0_0_2px_var(--c-accent)]',
              checked && result?.correct && 'shadow-[inset_0_0_0_2px_var(--c-ok)]',
              checked && result && !result.correct && 'shadow-[inset_0_0_0_2px_var(--c-bad)]',
            )}
          />
        </label>
      )}
    </div>
  );
}

export function checkGap(data: DeGapData, answer: unknown, { lang }: Pick<ExerciseContext, 'lang'>): CheckResult {
  const given = typeof answer === 'string' ? answer : '';
  const base: CheckResult = data.options
    ? { correct: data.answers.includes(given), solution: data.answers[0] }
    : checkText(given, data.answers, { ...lang.answerCheck, typoTolerance: false }, lang.normalizeAnswer);
  if (!data.explanation) return base;
  return { ...base, feedback: base.feedback ? `${base.feedback} ${data.explanation}` : data.explanation };
}

export const deGapPlugin: ExercisePlugin<DeGapData> = {
  type: 'de-gap',
  label: 'Completar',
  schema: deGapSchema,
  Component: Gap,
  check: checkGap,
};
