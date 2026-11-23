import { useEffect, useMemo, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { speak } from '@/core/audio';
import { choiceState } from '@/core/exercises/MultipleChoice';
import { ChoiceButton } from '@/core/exercises/shared';
import type { LanguagePack } from '@/core/types';
import { useProfile } from '@/hooks/useProfile';
import { numberDrill, type NumberDrill } from '../utils/numbers';

type Filter = 'todo' | NumberDrill['kind'];

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'hora', label: 'Hora' },
  { value: 'precio', label: 'Precio' },
  { value: 'descuento', label: 'Descuento' },
  { value: 'cifra', label: 'Cifras' },
];

/** horas, precios, descuentos y cifras al oído: ejercicios infinitos generados al momento */
export default function NumbersTool({ lang }: { lang: LanguagePack }) {
  const profile = useProfile();
  const rate = profile?.voiceRate ?? 0.9;
  const [filter, setFilter] = useState<Filter>('todo');
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const drill = useMemo(() => numberDrill(Math.random, filter === 'todo' ? undefined : filter), [filter, round]);
  const checked = answer !== null;

  useEffect(() => {
    speak(drill.audio, lang.locale, { rate });
  }, [drill, lang.locale, rate]);

  const choose = (i: number) => {
    if (checked) return;
    setAnswer(i);
    setScore((s) => ({ ok: s.ok + (i === drill.answer ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Tipo de ejercicio"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setAnswer(null);
          setRound((r) => r + 1);
        }}
        options={FILTERS}
      />

      <div className="card flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <SpeakButton text={drill.audio} locale={lang.locale} size="lg" label="Escuchar de nuevo" />
          <SpeakButton text={drill.audio} locale={lang.locale} slow label="Escuchar despacio" className="bg-sunken text-ink-2" />
          <p className="ml-auto text-sm font-semibold text-ink-2 tabular-nums">
            {score.ok}/{score.total}
          </p>
        </div>
        <p className="text-xl font-semibold tracking-tight">{drill.question}</p>
        <div className="grid gap-2.5" role="group" aria-label="Opciones">
          {drill.options.map((opt, i) => (
            <ChoiceButton
              key={`${round}-${opt}`}
              index={i}
              state={choiceState(i, { answer, status: checked ? 'checked' : 'answering', data: drill })}
              disabled={checked}
              onClick={() => choose(i)}
            >
              <span className="tabular-nums">{opt}</span>
            </ChoiceButton>
          ))}
        </div>
        {checked && (
          <div className="rounded-[var(--radius-control)] bg-sunken px-4 py-3">
            <p lang="zh-CN" className="font-han text-lg font-medium">
              {drill.audio}
            </p>
            <p className="mt-1 text-sm text-ink-2">{drill.why}</p>
          </div>
        )}
        <Button
          size="lg"
          disabled={!checked}
          onClick={() => {
            setAnswer(null);
            setRound((r) => r + 1);
          }}
        >
          Siguiente
        </Button>
      </div>
      <p className="px-1 text-sm text-ink-3">
        Apunta los números mientras escuchas y busca la palabra que los transforma: 差, 折, 一刻, 半, 两倍, 一半.
      </p>
    </div>
  );
}
