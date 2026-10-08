import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { checkText } from '@/core/answer-check';
import { ExerciseHeading } from '@/core/exercises/shared';
import type { ExercisePlugin, ExerciseProps } from '@/core/types';
import { TENSE_LABELS } from '../utils/conjugate';
import { ptConjugateSchema, type PtConjugateData } from './schemas';

function Conjugate({ data, answer, setAnswer, status, result, submit }: ExerciseProps<PtConjugateData>) {
  const value = typeof answer === 'string' ? answer : '';
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);
  const [before, after] = data.sentence?.split('___') ?? [];

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>Conjuga el verbo</ExerciseHeading>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Verbo', data.verb, data.verbMeaning],
          ['Persona', data.person, null],
          ['Tiempo', TENSE_LABELS[data.tense], null],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-[var(--radius-control)] bg-sunken px-2 py-3">
            <dt className="text-xs font-medium text-ink-3">{k}</dt>
            <dd lang="pt-BR" className="mt-0.5 font-bold text-ink">
              {v}
            </dd>
            {sub && <dd className="text-xs text-ink-3">{sub}</dd>}
          </div>
        ))}
      </dl>

      {data.sentence && (
        <p lang="pt-BR" className="text-xl leading-relaxed font-medium">
          {before}
          <span
            className={cn(
              'mx-1 inline-block min-w-16 border-b-2 text-center',
              value ? 'border-accent text-accent' : 'border-line text-ink-3',
            )}
          >
            {value || '\u00a0'}
          </span>
          {after}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">Forma conjugada</span>
        <input
          ref={inputRef}
          lang="pt-BR"
          value={value}
          readOnly={status === 'checked'}
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
            status === 'checked' && result?.correct && 'shadow-[inset_0_0_0_2px_var(--c-ok)]',
            status === 'checked' && result && !result.correct && 'shadow-[inset_0_0_0_2px_var(--c-bad)]',
          )}
        />
      </label>
    </div>
  );
}

export const ptConjugatePlugin: ExercisePlugin<PtConjugateData> = {
  type: 'pt-conjugate',
  label: 'Conjugar',
  schema: ptConjugateSchema,
  Component: Conjugate,
  check: (data, answer, { lang }) =>
    checkText(typeof answer === 'string' ? answer : '', [data.answer], { ...lang.answerCheck, typoTolerance: false }),
};
