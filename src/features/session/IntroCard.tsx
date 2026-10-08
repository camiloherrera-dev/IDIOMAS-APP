import { useEffect } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { TermText } from '@/components/TermText';
import { speak } from '@/core/audio';
import type { LanguagePack, Term } from '@/core/types';
import { ExerciseHeading } from '@/core/exercises/shared';
import { useProfile } from '@/hooks/useProfile';

/** presentación de una palabra nueva antes de los ejercicios */
export function IntroCard({ term, lang }: { term: Term; lang: LanguagePack }) {
  const profile = useProfile();
  const rate = profile?.voiceRate ?? 0.9;

  useEffect(() => {
    speak(term.term, lang.locale, { rate });
  }, [term.term, lang.locale, rate]);

  const example = term.examples[0];
  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>Palabra nueva</ExerciseHeading>

      <div className="card flex flex-col items-center gap-5 px-6 pt-10 pb-8 text-center">
        <TermText lang={lang} term={term} size="xl" />
        <SpeakButton text={term.term} locale={lang.locale} size="md" />
        <div>
          <p className="text-2xl font-semibold tracking-tight">{term.meaning.es}</p>
          {term.pos && <p className="mt-1 text-sm text-ink-3">{term.pos}</p>}
        </div>
      </div>

      {example && (
        <div className="flex items-start gap-3 rounded-[var(--radius-control)] bg-sunken p-4">
          <SpeakButton text={example.text} locale={lang.locale} size="sm" label="Escuchar el ejemplo" />
          <div className="min-w-0">
            <p lang={lang.locale} className="text-lg leading-snug font-medium">
              {example.text}
            </p>
            {example.reading && <p className="text-sm text-ink-2">{example.reading}</p>}
            <p className="mt-0.5 text-ink-2">{example.translation}</p>
          </div>
        </div>
      )}

      {term.notes && <p className="text-[0.95rem] leading-relaxed text-ink-2">{term.notes}</p>}
    </div>
  );
}
