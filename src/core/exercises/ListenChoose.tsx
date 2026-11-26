import { listenChooseSchema, type ListenChooseData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { ListenControls } from './ListenControls';
import { choiceState } from './MultipleChoice';
import { ChoiceButton, ExerciseHeading } from './shared';

function ListenChoose({ data, ctx, answer, setAnswer, status }: ExerciseProps<ListenChooseData>) {
  const { lang } = ctx;

  const rate = ctx.prefs.voiceRate;

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>{data.question ?? 'Escucha y elige'}</ExerciseHeading>

      <ListenControls
        text={data.audioText}
        locale={lang.locale}
        rate={rate}
        reveal={status === 'checked'}
        subtitleClassName={lang.script === 'hanzi' ? 'font-han text-xl' : undefined}
      />

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
              lang={data.targetOptions ? lang.locale : 'es'}
              className={data.targetOptions && lang.script === 'hanzi' ? 'font-han text-xl' : undefined}
            >
              {opt}
            </span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export const listenChoosePlugin: ExercisePlugin<ListenChooseData> = {
  type: 'listen-choose',
  label: 'Escuchar y elegir',
  schema: listenChooseSchema,
  Component: ListenChoose,
  check: (data, answer) => ({ correct: answer === data.answer, solution: data.options[data.answer] }),
};
