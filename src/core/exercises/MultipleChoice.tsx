import { SpeakButton } from '@/components/SpeakButton';
import { TermText } from '@/components/TermText';
import { multipleChoiceSchema, type MultipleChoiceData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { ChoiceButton, ExerciseHeading, type ChoiceState } from './shared';

function choiceState(
  i: number,
  { answer, status, data }: { answer: unknown; status: string; data: { answer: number } },
): ChoiceState {
  if (status === 'checked') {
    if (i === data.answer) return 'correct';
    if (i === answer) return 'wrong';
    return 'dim';
  }
  return i === answer ? 'selected' : 'idle';
}

function MultipleChoice({ data, ctx, answer, setAnswer, status }: ExerciseProps<MultipleChoiceData>) {
  const { lang } = ctx;
  const promptIsTarget = Boolean(data.speakPrompt);
  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>{data.question ?? (promptIsTarget ? '¿Qué significa?' : '¿Cómo se dice?')}</ExerciseHeading>

      <div className="flex items-center gap-4 py-2">
        {promptIsTarget && <SpeakButton text={data.prompt} locale={lang.locale} />}
        {promptIsTarget ? (
          <TermText lang={lang} term={{ term: data.prompt, reading: data.promptReading }} size="lg" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{data.prompt}</p>
        )}
      </div>

      <div className="grid gap-2.5" role="group" aria-label="Opciones">
        {data.options.map((opt, i) => (
          <ChoiceButton
            key={`${i}-${opt}`}
            index={i}
            state={choiceState(i, { answer, status, data })}
            disabled={status === 'checked'}
            onClick={() => setAnswer(i)}
          >
            <span
              lang={promptIsTarget ? 'es' : lang.locale}
              className={!promptIsTarget && lang.script === 'hanzi' ? 'text-xl' : undefined}
            >
              {opt}
            </span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export const multipleChoicePlugin: ExercisePlugin<MultipleChoiceData> = {
  type: 'multiple-choice',
  label: 'Opción múltiple',
  schema: multipleChoiceSchema,
  Component: MultipleChoice,
  check: (data, answer) => ({ correct: answer === data.answer, solution: data.options[data.answer] }),
};

export { choiceState };
