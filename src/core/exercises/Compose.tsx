import { Check, PencilSimpleLine } from '@phosphor-icons/react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { composeSchema, type ComposeData } from '../schema';
import type { CheckResult, ExercisePlugin, ExerciseProps } from '../types';
import { ExerciseHeading } from './shared';

export type ComposeAnswer = { text: string } | { hand: true };

const HAN = /\p{Script=Han}/gu;
export const countHan = (s: string) => s.match(HAN)?.length ?? 0;

/**
 * Comprueba lo que se puede comprobar sin un corrector: que estén las palabras pedidas
 * y que el texto llegue al mínimo de caracteres. La gramática se compara con el modelo.
 */
export function checkCompose(data: ComposeData, answer: unknown): CheckResult {
  const a = answer as ComposeAnswer | null;
  if (a && 'hand' in a)
    return {
      correct: true,
      feedback: 'Compáralo con el texto modelo: ¿usaste las palabras pedidas y el mismo orden en las frases?',
    };
  const text = a && 'text' in a ? a.text : '';
  const n = countHan(text);
  const missing = data.must.filter((w) => !text.includes(w));
  if (!missing.length && n >= data.minChars)
    return { correct: true, feedback: 'Cumple lo pedido. Ahora compáralo con el texto modelo.' };
  const problems = [
    missing.length ? `falta usar ${missing.map((w) => `«${w}»`).join(', ')}` : '',
    n < data.minChars ? `tiene ${n} de ${data.minChars} caracteres` : '',
  ].filter(Boolean);
  // casi: llega al mínimo y falta como mucho una palabra, o usa todas y se queda un poco corto
  const close = (missing.length <= 1 && n >= data.minChars) || (!missing.length && n >= data.minChars * 0.7);
  return { correct: close, partial: close, feedback: `Tu texto ${problems.join(' y ')}.` };
}

function Compose({ data, ctx, answer, setAnswer, status }: ExerciseProps<ComposeData>) {
  const { lang } = ctx;
  const checked = status === 'checked';
  const a = answer as ComposeAnswer | null;
  const hand = Boolean(a && 'hand' in a);
  const text = a && 'text' in a ? a.text : '';
  const n = countHan(text);
  const han = lang.script === 'hanzi';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-accent">Escritura</p>
        <ExerciseHeading>{data.prompt}</ExerciseHeading>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Requisitos">
        {data.must.map((w) => {
          const ok = !hand && text.includes(w);
          return (
            <li
              key={w}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-base font-semibold',
                han && 'font-han',
                ok ? 'bg-ok-soft text-ok' : 'bg-sunken text-ink-2',
              )}
            >
              {ok && <Check size={14} weight="bold" />}
              {w}
            </li>
          );
        })}
        <li
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
            !hand && n >= data.minChars ? 'bg-ok-soft text-ok' : 'bg-sunken text-ink-2',
          )}
        >
          {hand ? `mínimo ${data.minChars} caracteres` : `${n} / ${data.minChars} caracteres`}
        </li>
      </ul>

      {hand ? (
        <div className="card flex items-start gap-3 p-4 text-ink-2">
          <PencilSimpleLine size={22} className="mt-0.5 shrink-0 text-accent" />
          <p>
            Escríbelo en papel con las palabras de arriba. Cuando termines, toca «Comprobar» para ver el texto modelo y
            compararlo.
          </p>
        </div>
      ) : (
        <textarea
          lang={lang.locale}
          value={text}
          disabled={checked}
          onChange={(e) => setAnswer(e.target.value.trim() ? { text: e.target.value } : null)}
          rows={5}
          placeholder="Escribe aquí con el teclado de pinyin"
          aria-label="Tu texto"
          className={cn(
            'w-full resize-none rounded-[var(--radius-control)] bg-surface p-4 text-ink outline-none hairline placeholder:font-sans placeholder:text-base placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]',
            han ? 'font-han text-xl leading-relaxed' : 'text-lg',
          )}
        />
      )}

      {!checked && (
        <button
          type="button"
          className="self-start text-sm font-semibold text-accent"
          onClick={() => setAnswer(hand ? (text ? { text } : null) : { hand: true })}
        >
          {hand ? 'Mejor lo escribo con el teclado' : 'Prefiero escribirlo a mano en papel'}
        </button>
      )}

      {checked && (
        <div className="rounded-[var(--radius-control)] bg-sunken p-4">
          <p className="text-sm font-semibold text-ink-2">Texto modelo</p>
          <div className="mt-2 flex items-start gap-3">
            <SpeakButton text={data.model} locale={lang.locale} size="sm" label="Escuchar el modelo" />
            <div className="min-w-0">
              <p lang={lang.locale} className={cn(han ? 'font-han text-lg leading-relaxed' : 'font-medium')}>
                {data.model}
              </p>
              {data.modelTr && <p className="mt-1 text-sm text-ink-2">{data.modelTr}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            La app comprueba las palabras y la longitud. El orden de las frases y la gramática compáralos tú con el modelo.
          </p>
        </div>
      )}
    </div>
  );
}

export const composePlugin: ExercisePlugin<ComposeData> = {
  type: 'compose',
  label: 'Escribir un texto',
  schema: composeSchema,
  Component: Compose,
  check: (data, answer) => checkCompose(data, answer),
};
