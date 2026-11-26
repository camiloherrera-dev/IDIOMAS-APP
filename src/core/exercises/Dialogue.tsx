import { Play } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { speakSequence, ttsSupported } from '../audio';
import { dialogueSchema, type DialogueData } from '../schema';
import type { ExercisePlugin, ExerciseProps } from '../types';
import { replayRate, SUBTITLE_AFTER } from './ListenControls';
import { choiceState } from './MultipleChoice';
import { ChoiceButton, ExerciseHeading } from './shared';

// tonos moderados: muy agudo o muy grave vuelve la voz sintética difícil de entender
const PITCH = { F: 1.15, M: 0.85, N: 1 } as const;
const WHO = { F: 'Ella', M: 'Él', N: '' } as const;

/** diálogo solo de escucha: dos voces y una pregunta al final; el texto aparece al comprobar */
function Dialogue({ data, ctx, answer, setAnswer, status }: ExerciseProps<DialogueData>) {
  const { lang } = ctx;
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const rate = ctx.prefs.voiceRate;

  const count = useRef(0);
  const play = useCallback(() => {
    setPlaying(true);
    count.current += 1;
    setPlays(count.current);
    speakSequence(
      [...data.turns.map((t) => ({ text: t.text, pitch: PITCH[t.s] })), { text: data.question, pitch: 1 }],
      lang.locale,
      {
        rate: replayRate(rate, count.current),
        onEnd: () => setPlaying(false),
      },
    );
  }, [data, lang.locale, rate]);

  // intento de reproducción automática (iOS puede exigir un toque)
  useEffect(() => {
    count.current = 0;
    play();
  }, [play]);

  const checked = status === 'checked';
  // a la tercera escucha aparece el texto, como subtítulo
  const subtitle = checked || plays >= SUBTITLE_AFTER;
  return (
    <div className="flex flex-col gap-5">
      <ExerciseHeading>Escucha el diálogo</ExerciseHeading>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={play}
          disabled={!ttsSupported()}
          aria-label="Escuchar el diálogo"
          className={cn(
            'pressable inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent disabled:bg-sunken disabled:text-ink-3',
            playing && 'ring-2 ring-accent/40',
          )}
        >
          <Play size={28} weight="fill" />
        </button>
        <p className="text-sm text-ink-2">
          {checked
            ? 'Vuelve a escucharlo leyendo el texto.'
            : subtitle
              ? 'Ya puedes leer lo que dicen.'
              : plays > 1
                ? 'En el examen real suena una sola vez. A la tercera escucha aparece el texto.'
                : 'La pregunta se oye al final.'}
        </p>
      </div>

      {subtitle && (
        <div className="rounded-[var(--radius-control)] bg-sunken px-4 py-3" data-testid="subtitulo">
          <ul lang={lang.locale} className={cn('grid gap-1', lang.script === 'hanzi' && 'font-han text-lg')}>
            {data.turns.map((t, i) => (
              <li key={i}>
                {WHO[t.s] && <span className="mr-2 font-sans text-xs font-semibold text-ink-3">{WHO[t.s]}</span>}
                {t.text}
              </li>
            ))}
          </ul>
          {checked && data.tr && <p className="mt-2 text-sm text-ink-2">{data.tr}</p>}
        </div>
      )}

      <p
        lang={lang.locale}
        className={cn(
          'font-semibold',
          lang.script === 'hanzi' ? 'font-han text-xl' : 'text-lg',
          !checked && plays < 1 && 'invisible',
        )}
      >
        {data.question}
      </p>

      <div className="grid gap-2.5" role="group" aria-label="Opciones">
        {data.options.map((opt, i) => (
          <ChoiceButton
            key={`${i}-${opt}`}
            index={i}
            state={choiceState(i, { answer, status, data })}
            disabled={checked}
            onClick={() => setAnswer(i)}
          >
            <span lang={lang.locale} className={lang.script === 'hanzi' ? 'font-han text-xl' : undefined}>
              {opt}
            </span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export const dialoguePlugin: ExercisePlugin<DialogueData> = {
  type: 'dialogue',
  label: 'Diálogo de escucha',
  schema: dialogueSchema,
  Component: Dialogue,
  check: (data, answer) => ({ correct: answer === data.answer, solution: data.options[data.answer] }),
};
