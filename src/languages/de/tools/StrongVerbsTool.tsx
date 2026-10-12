import { MagnifyingGlass } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/Segmented';
import { stripDiacritics } from '@/core/answer-check';
import type { LanguagePack } from '@/core/types';
import { normalizeGerman } from '../utils/normalize';
import { KIND_LABELS, STRONG_VERBS, type StrongVerb, type StrongVerbKind } from './strong-verbs';

type Filter = 'todos' | StrongVerbKind;

/** búsqueda tolerante: sin mayúsculas, ß = ss y sin diéresis (fahrt encuentra fährt) */
const fold = (s: string) => stripDiacritics(normalizeGerman(s.toLowerCase()));

const KIND_STYLE: Record<StrongVerbKind, string> = {
  fuerte: 'bg-accent-soft text-accent',
  mixto: 'bg-warn-soft text-ink',
  irregular: 'bg-bad-soft text-ink',
  modal: 'bg-ok-soft text-ink',
};

function VerbCard({ verb, locale }: { verb: StrongVerb; locale: string }) {
  const rows: [string, string, string][] = [
    ['Presente (er)', verb.present, `er ${verb.present}`],
    ['Präteritum', verb.past, `er ${verb.past}`],
    ['Perfekt', verb.perfect, `er ${verb.perfect}`],
  ];
  return (
    <li className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span lang="de-DE" className="text-xl font-bold tracking-tight">
              {verb.inf}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', KIND_STYLE[verb.kind])}>
              {KIND_LABELS[verb.kind]}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-ink-2">{verb.meaning}</p>
        </div>
        <SpeakButton text={verb.inf} locale={locale} size="sm" label={`Escuchar ${verb.inf}`} />
      </div>
      <dl className="divide-y divide-line border-t border-line">
        {rows.map(([label, form, spoken]) => (
          <div key={label} className="flex items-center gap-3 px-4 py-1.5">
            <dt className="w-24 shrink-0 text-xs font-medium text-ink-3">{label}</dt>
            <dd lang="de-DE" className="min-w-0 flex-1 text-[1.0625rem] font-semibold">
              {form}
            </dd>
            <dd>
              <SpeakButton text={spoken} locale={locale} size="sm" label={`Escuchar ${spoken}`} />
            </dd>
          </div>
        ))}
      </dl>
      {verb.note && <p className="border-t border-line bg-sunken px-4 py-2.5 text-sm text-ink-2">{verb.note}</p>}
    </li>
  );
}

export default function StrongVerbsTool({ lang }: { lang: LanguagePack }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const q = fold(query.trim());
  const list = useMemo(
    () =>
      STRONG_VERBS.filter(
        (v) =>
          (filter === 'todos' || v.kind === filter) &&
          (!q || fold(`${v.inf} ${v.present} ${v.past} ${v.perfect} ${v.meaning}`).includes(q)),
      ),
    [q, filter],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-2">
        Los verbos fuertes cambian la vocal de la raíz y forman el participio en <span lang="de-DE">-en</span>. Los que indican
        movimiento o cambio de estado forman el Perfekt con <strong className="text-ink">sein</strong>.
      </p>

      <label className="relative block">
        <span className="sr-only">Buscar verbo</span>
        <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca en alemán o en español"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 w-full rounded-[var(--radius-control)] bg-surface pr-4 pl-11 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
        />
      </label>

      <Segmented
        label="Tipo de verbo"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'fuerte', label: 'Fuertes' },
          { value: 'mixto', label: 'Mixtos' },
          { value: 'irregular', label: 'Irregulares' },
          { value: 'modal', label: 'Modales' },
        ]}
      />

      <p className="text-sm text-ink-3" aria-live="polite">
        {list.length} {list.length === 1 ? 'verbo' : 'verbos'}
      </p>

      <ul className="grid gap-3">
        {list.map((v) => (
          <VerbCard key={v.inf} verb={v} locale={lang.locale} />
        ))}
        {list.length === 0 && <li className="py-8 text-center text-ink-2">Sin resultados para «{query}».</li>}
      </ul>
    </div>
  );
}
