import { SpeakerHigh, SpeakerSimpleSlash } from '@phosphor-icons/react';
import { useState } from 'react';
import { speak, ttsSupported } from '@/core/audio';
import { useProfile } from '@/hooks/useProfile';
import { cn } from './ui/cn';

interface Props {
  text: string;
  locale: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  /** velocidad relativa a la del perfil (p. ej. 0.7 para "lento") */
  slow?: boolean;
}

const SIZES = { sm: 'size-9', md: 'size-11', lg: 'size-16' } as const;
const ICON = { sm: 18, md: 22, lg: 30 } as const;

export function SpeakButton({ text, locale, size = 'md', className, label = 'Escuchar', slow }: Props) {
  const profile = useProfile();
  const [playing, setPlaying] = useState(false);
  const supported = ttsSupported();

  return (
    <button
      type="button"
      aria-label={supported ? label : 'Audio no disponible en este navegador'}
      title={supported ? label : 'Audio no disponible en este navegador'}
      disabled={!supported}
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
        const rate = (profile?.voiceRate ?? 0.9) * (slow ? 0.7 : 1);
        speak(text, locale, { rate, onEnd: () => setPlaying(false) });
      }}
      className={cn(
        'pressable inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent',
        'disabled:bg-sunken disabled:text-ink-3',
        playing && 'ring-2 ring-accent/40',
        SIZES[size],
        className,
      )}
    >
      {supported ? <SpeakerHigh size={ICON[size]} weight="fill" /> : <SpeakerSimpleSlash size={ICON[size]} />}
    </button>
  );
}
