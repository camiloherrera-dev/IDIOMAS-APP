import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeakerHigh, SpeakerSimpleSlash, Timer } from '@phosphor-icons/react';
import { cn } from '@/components/ui/cn';
import { speak, ttsSupported } from '../audio';

/** escuchas a partir de las cuales se muestra el texto de lo que se oye */
export const SUBTITLE_AFTER = 3;

/** velocidad de cada escucha: la segunda va algo más lenta y la tercera, despacio */
export const replayRate = (base: number, play: number) => base * (play >= 3 ? 0.75 : play === 2 ? 0.88 : 1);

interface Props {
  text: string;
  locale: string;
  /** velocidad del perfil */
  rate: number;
  /** clase del subtítulo (p. ej. fuente CJK) */
  subtitleClassName?: string;
  /** si true, el texto se muestra ya (ejercicio comprobado) */
  reveal?: boolean;
}

/**
 * Botones de audio de los ejercicios de escucha. Suena solo al aparecer; cada vez que se
 * vuelve a oír va un poco más lento, y a la tercera escucha aparece el texto como subtítulo.
 */
export function ListenControls({ text, locale, rate, subtitleClassName, reveal }: Props) {
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const count = useRef(0);
  const supported = ttsSupported();

  const play = useCallback(
    (slow = false) => {
      count.current += 1;
      setPlays(count.current);
      setPlaying(true);
      speak(text, locale, {
        rate: slow ? rate * 0.7 : replayRate(rate, count.current),
        onEnd: () => setPlaying(false),
      });
    },
    [text, locale, rate],
  );

  // intento de reproducción automática: iOS puede bloquearlo si no viene de un toque
  useEffect(() => {
    count.current = 0;
    play();
  }, [play]);

  const subtitle = reveal || plays >= SUBTITLE_AFTER;
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => play()}
          disabled={!supported}
          aria-label="Escuchar de nuevo"
          className={cn(
            'pressable inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent disabled:bg-sunken disabled:text-ink-3',
            playing && 'ring-2 ring-accent/40',
          )}
        >
          {supported ? <SpeakerHigh size={30} weight="fill" /> : <SpeakerSimpleSlash size={30} />}
        </button>
        <button
          type="button"
          onClick={() => play(true)}
          disabled={!supported}
          aria-label="Escuchar despacio"
          className="pressable inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 disabled:text-ink-3"
        >
          <Timer size={22} weight="fill" />
        </button>
      </div>
      {subtitle ? (
        <p
          lang={locale}
          className={cn('text-center text-lg font-semibold text-ink-2', subtitleClassName)}
          data-testid="subtitulo"
        >
          {text}
        </p>
      ) : (
        plays >= 2 && <p className="text-center text-sm text-ink-3">Si lo escuchas una vez más, aparece el texto.</p>
      )}
    </div>
  );
}
