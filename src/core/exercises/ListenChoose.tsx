import { useEffect } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { speak } from '@/core/audio';
import { listenChooseSchema, type ListenChooseData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { choiceState } from './MultipleChoice';
import { ChoiceButton, ExerciseHeading } from './shared';

function ListenChoose({ data, ctx, answer, setAnswer, status }: ExerciseProps<ListenChooseData>) {
  const { lang } = ctx;

  // Intento de reproducción automática: iOS puede bloquearlo si no viene de un toque.
  const rate = ctx.prefs.voiceRate;
  useEffect(() => {
    speak(data.audioText, lang.locale, { rate });
  }, [data.audioText, lang.locale, rate]);

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>{data.question ?? 'Escucha y elige'}</ExerciseHeading>

      <div className="flex items-center justify-center gap-4 py-4">
        <SpeakButton text={data.audioText} locale={lang.locale} size="lg" label="Escuchar de nuevo" />
        <SpeakButton
          text={data.audioText}
          locale={lang.locale}
          size="md"
          slow
          label="Escuchar despacio"
          className="bg-sunken text-ink-2"
        />
      </div>
      {status === 'checked' && (
        <p lang={lang.locale} className="-mt-3 text-center text-lg font-semibold text-ink-2">
          {data.audioText}
        </p>
      )}

      <div className="grid gap-2.5" role="group" aria-label="Opciones">
        {data.options.map((opt, i) => (
          <ChoiceButton
            key={`${i}-${opt}`}
            index={i}
            state={choiceState(i, { answer, status, data })}
            disabled={status === 'checked'}
            onClick={() => setAnswer(i)}
          >
            {opt}
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
