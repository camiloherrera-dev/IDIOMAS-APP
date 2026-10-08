import { useEffect, useRef } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { checkText } from '../answer-check';
import { translateWriteSchema, type TranslateWriteData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { ExerciseHeading } from './shared';

function TranslateWrite({ data, ctx, answer, setAnswer, status, result, submit }: ExerciseProps<TranslateWriteData>) {
  const { lang } = ctx;
  const toTarget = data.direction === 'to-target';
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const value = typeof answer === 'string' ? answer : '';

  useEffect(() => {
    // en iOS el teclado solo se abre con foco tras un toque; en escritorio ayuda
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>{toTarget ? `Escríbelo en ${lang.name.toLowerCase()}` : 'Escríbelo en español'}</ExerciseHeading>

      <div className="flex items-center gap-4 py-1">
        {!toTarget && <SpeakButton text={data.prompt} locale={lang.locale} />}
        <p
          lang={toTarget ? 'es' : lang.locale}
          className={cn('font-semibold tracking-tight', !toTarget && lang.script === 'hanzi' ? 'text-3xl' : 'text-2xl')}
        >
          {data.prompt}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">Tu respuesta</span>
        <textarea
          ref={inputRef}
          lang={toTarget ? lang.locale : 'es'}
          value={value}
          rows={3}
          readOnly={status === 'checked'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setAnswer(e.target.value.length ? e.target.value : null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) submit();
            }
          }}
          className={cn(
            'w-full resize-none rounded-[var(--radius-control)] bg-surface px-4 py-3.5 text-[1.125rem] leading-snug text-ink outline-none hairline',
            'placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]',
            status === 'checked' && result?.correct && 'shadow-[inset_0_0_0_2px_var(--c-ok)]',
            status === 'checked' && result && !result.correct && 'shadow-[inset_0_0_0_2px_var(--c-bad)]',
          )}
        />
        {data.hint && <span className="text-sm text-ink-3">{data.hint}</span>}
      </label>

      {status === 'checked' && toTarget && result?.solution && (
        <div className="flex items-center gap-3">
          <SpeakButton text={result.solution} locale={lang.locale} size="sm" />
          <span lang={lang.locale} className="text-ink-2">
            {result.solution}
          </span>
        </div>
      )}
    </div>
  );
}

export const translateWritePlugin: ExercisePlugin<TranslateWriteData> = {
  type: 'translate-write',
  label: 'Traducir escribiendo',
  schema: translateWriteSchema,
  Component: TranslateWrite,
  check: (data, answer, { lang }) => {
    const input = typeof answer === 'string' ? answer : '';
    if (data.direction === 'to-native') {
      return checkText(input, data.answers, { diacritics: 'lenient', typoTolerance: true });
    }
    return checkText(input, data.answers, lang.answerCheck, lang.normalizeAnswer);
  },
};
