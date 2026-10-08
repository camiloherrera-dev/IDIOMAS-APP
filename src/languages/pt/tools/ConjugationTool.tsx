import { MagnifyingGlass, Warning } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/Segmented';
import type { LanguagePack } from '@/core/types';
import { COMMON_VERBS, conjugateAll, isIrregular, PT_PERSONS, PT_TENSES, TENSE_LABELS, type PtTense } from '../utils/conjugate';

const SLOT = [0, 1, 1, 2, 3, 3] as const;
const VERB_RE = /^[a-zà-úç]+(ar|er|ir)$|^pôr$/;

export default function ConjugationTool({ lang }: { lang: LanguagePack }) {
  const [verb, setVerb] = useState('ser');
  const [query, setQuery] = useState('');
  const [tense, setTense] = useState<PtTense>('presente');

  const q = query.trim().toLowerCase();
  const suggestions = useMemo(
    () => (q ? COMMON_VERBS.filter((v) => v.verb.startsWith(q) || v.meaning.includes(q)) : COMMON_VERBS),
    [q],
  );
  const forms = conjugateAll(verb, tense);
  const meaning = COMMON_VERBS.find((v) => v.verb === verb)?.meaning;
  const known = COMMON_VERBS.some((v) => v.verb === verb);
  const canUseQuery = VERB_RE.test(q) && q !== verb && !COMMON_VERBS.some((v) => v.verb === q);

  const choose = (v: string) => {
    setVerb(v);
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-5">
      <label className="relative block">
        <span className="sr-only">Buscar verbo</span>
        <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && VERB_RE.test(q)) choose(q);
          }}
          placeholder="Busca o escribe un verbo (viajar)"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-12 w-full rounded-[var(--radius-control)] bg-surface pr-4 pl-11 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
        />
      </label>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {canUseQuery && (
          <button
            type="button"
            onClick={() => choose(q)}
            className="pressable min-h-11 shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            Conjugar «{q}»
          </button>
        )}
        {suggestions.map((v) => (
          <button
            key={v.verb}
            type="button"
            onClick={() => choose(v.verb)}
            className={cn(
              'pressable min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold',
              v.verb === verb ? 'bg-accent text-accent-ink' : 'bg-surface text-ink hairline',
            )}
          >
            {v.verb}
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 lang="pt-BR" className="text-3xl font-bold tracking-tight">
            {verb}
          </h2>
          <p className="flex items-center gap-2 text-ink-2">
            {meaning ?? 'Verbo'}
            {isIrregular(verb) && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-ink">irregular</span>
            )}
          </p>
        </div>
        <SpeakButton text={verb} locale={lang.locale} />
      </div>

      <Segmented
        label="Tiempo verbal"
        value={tense}
        onChange={setTense}
        options={PT_TENSES.map((t) => ({ value: t, label: TENSE_LABELS[t] }))}
      />

      {forms ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {PT_PERSONS.map((p, i) => (
            <li key={p} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-20 shrink-0 text-sm text-ink-3">{p}</span>
              <span lang="pt-BR" className="flex-1 text-lg font-semibold">
                {forms[SLOT[i]]}
              </span>
              <SpeakButton text={`${p.split('/')[0]} ${forms[SLOT[i]]}`} locale={lang.locale} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2">No se pudo conjugar este verbo.</p>
      )}

      {!known && (
        <p className="flex gap-2 rounded-[var(--radius-control)] bg-warn-soft p-3 text-sm text-ink">
          <Warning size={18} className="mt-0.5 shrink-0 text-warn" weight="fill" />
          Conjugación regular calculada. Si el verbo es irregular, algunas formas pueden no ser correctas.
        </p>
      )}
    </div>
  );
}
