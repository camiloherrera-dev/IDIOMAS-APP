import { ArrowLeft, BookBookmark, CheckCircle, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { SpeakButton } from '@/components/SpeakButton';
import { TermText } from '@/components/TermText';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { ScreenSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { normalize, stripDiacritics } from '@/core/answer-check';
import { addTermsToDeck, cardId } from '@/core/srs';
import type { LanguagePack, Term } from '@/core/types';
import { db } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';

type Filter = 'all' | 'deck' | 'mine';

interface Entry extends Term {
  custom?: boolean;
}

const fold = (s: string) => stripDiacritics(normalize(s));

export function DictionaryPage() {
  const { lang, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [adding, setAdding] = useState(false);

  const custom = useLiveQuery(() => (lang ? db.customTerms.where('langId').equals(lang.id).toArray() : []), [lang?.id]);
  const deck = useLiveQuery(
    async () => new Set((lang ? await db.cards.where('langId').equals(lang.id).toArray() : []).map((c) => c.termId)),
    [lang?.id],
  );

  const entries: Entry[] = useMemo(() => {
    const mine: Entry[] = (custom ?? []).map((c) => ({
      id: c.id,
      term: c.term,
      reading: c.reading,
      meaning: { es: c.meaning },
      notes: c.notes,
      tags: c.tags,
      examples: [],
      custom: true,
    }));
    return [...mine, ...(content?.vocab ?? [])];
  }, [custom, content]);

  const list = useMemo(() => {
    const query = fold(q);
    return entries.filter((e) => {
      if (filter === 'deck' && !deck?.has(e.id)) return false;
      if (filter === 'mine' && !e.custom) return false;
      if (!query) return true;
      return [e.term, e.reading ?? '', e.meaning.es, ...e.tags].some((s) => fold(s).includes(query));
    });
  }, [entries, q, filter, deck]);

  if (!lang || !content || !deck) return <ScreenSkeleton />;

  return (
    <div>
      <header className="pt-safe flex items-center justify-between gap-2 px-3 pb-1">
        <IconButton label="Volver" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={16} weight="bold" />
          Agregar palabra
        </Button>
      </header>
      <div className="px-5">
        <h1 className="pt-1 text-[2rem] leading-tight font-bold tracking-tight">Mis palabras</h1>
        <p className="text-ink-2">
          {entries.length} en el curso de {lang.name.toLowerCase()}, {deck.size} en tu mazo.
        </p>

        <label className="relative mt-5 block">
          <span className="sr-only">Buscar palabra</span>
          <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang.features.romanization === 'pinyin' ? 'Hanzi, pinyin o español' : 'Palabra o significado'}
            autoCapitalize="off"
            autoCorrect="off"
            className="h-12 w-full rounded-[var(--radius-control)] bg-surface pr-4 pl-11 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
          />
        </label>

        <Segmented
          className="mt-3"
          label="Filtrar"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'deck', label: 'En mi mazo' },
            { value: 'mine', label: 'Agregadas por mí' },
          ]}
        />

        {list.length === 0 ? (
          <EmptyState
            icon={<BookBookmark size={26} weight="fill" />}
            title={filter === 'mine' && !q ? 'Aún no agregaste palabras' : 'Sin resultados'}
            body={
              filter === 'mine' && !q
                ? 'Guarda aquí palabras que encuentres en series, canciones o conversaciones.'
                : 'Prueba con otra palabra o cambia el filtro.'
            }
            action={
              filter === 'mine' && !q ? (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} weight="bold" /> Agregar palabra
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="card mt-4 mb-4 divide-y divide-line overflow-hidden">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken active:bg-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span lang={lang.locale} className={cn('font-semibold', lang.script === 'hanzi' && 'font-han text-xl')}>
                        {e.term}
                      </span>
                      {e.reading && <span className="truncate text-sm text-ink-3">{e.reading}</span>}
                    </span>
                    <span className="block truncate text-sm text-ink-2">{e.meaning.es}</span>
                  </span>
                  {deck.has(e.id) && (
                    <CheckCircle size={20} weight="fill" className="shrink-0 text-accent" aria-label="En tu mazo" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? 'Ficha de palabra' : ''}>
        {selected && <TermDetail entry={selected} lang={lang} inDeck={deck.has(selected.id)} onDone={() => setSelected(null)} />}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Agregar palabra">
        <AddTermForm lang={lang} onDone={() => setAdding(false)} />
      </Sheet>
    </div>
  );
}

function TermDetail({ entry, lang, inDeck, onDone }: { entry: Entry; lang: LanguagePack; inDeck: boolean; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-5 px-2 pb-3">
      <div className="flex items-center gap-4">
        <SpeakButton text={entry.term} locale={lang.locale} />
        <TermText lang={lang} term={entry} size="lg" />
      </div>
      <div>
        <p className="text-xl font-semibold">{entry.meaning.es}</p>
        {entry.pos && <p className="text-sm text-ink-3">{entry.pos}</p>}
        {entry.notes && <p className="mt-2 text-ink-2">{entry.notes}</p>}
      </div>

      {entry.examples.length > 0 && (
        <ul className="grid gap-2">
          {entry.examples.map((ex, i) => (
            <li key={i} className="flex items-start gap-3 rounded-[var(--radius-control)] bg-sunken p-3">
              <SpeakButton text={ex.text} locale={lang.locale} size="sm" />
              <div>
                <p lang={lang.locale} className="font-medium">
                  {ex.text}
                </p>
                {ex.reading && <p className="text-sm text-ink-2">{ex.reading}</p>}
                <p className="text-sm text-ink-2">{ex.translation}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lang.termDetail && (
        <Suspense fallback={<Skeleton className="h-40" />}>
          <lang.termDetail term={entry} />
        </Suspense>
      )}

      {entry.custom ? (
        <Button
          variant="danger"
          size="lg"
          onClick={async () => {
            await db.transaction('rw', db.customTerms, db.cards, async () => {
              await db.customTerms.delete(entry.id);
              await db.cards.delete(cardId(lang.id, entry.id));
            });
            toast('Palabra eliminada');
            onDone();
          }}
        >
          <Trash size={18} weight="bold" /> Eliminar palabra
        </Button>
      ) : inDeck ? (
        <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <CheckCircle size={18} weight="fill" className="text-accent" /> Ya está en tu mazo de repaso.
        </p>
      ) : (
        <Button
          size="lg"
          onClick={async () => {
            await addTermsToDeck(lang.id, [entry.id]);
            toast.success('Agregada a tu mazo');
            onDone();
          }}
        >
          <Plus size={18} weight="bold" /> Agregar al mazo
        </Button>
      )}
    </div>
  );
}

function AddTermForm({ lang, onDone }: { lang: LanguagePack; onDone: () => void }) {
  const [term, setTerm] = useState('');
  const [reading, setReading] = useState('');
  const [meaning, setMeaning] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const needsReading = lang.features.romanization === 'pinyin';

  const field =
    'h-12 w-full rounded-[var(--radius-control)] bg-sunken px-4 text-ink outline-none placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]';

  return (
    <form
      className="flex flex-col gap-4 px-2 pb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!term.trim() || !meaning.trim()) {
          setError('Escribe la palabra y su significado.');
          return;
        }
        const id = `custom-${Date.now().toString(36)}`;
        const finalReading =
          needsReading && reading.trim()
            ? (lang.normalizeAnswer?.(reading.trim()) ?? reading.trim())
            : reading.trim() || undefined;
        await db.customTerms.add({
          id,
          langId: lang.id,
          term: term.trim(),
          reading: finalReading,
          meaning: meaning.trim(),
          notes: notes.trim() || undefined,
          tags: ['propia'],
          createdAt: Date.now(),
        });
        await addTermsToDeck(lang.id, [id]);
        toast.success('Palabra agregada a tu mazo');
        onDone();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">Palabra en {lang.name.toLowerCase()}</span>
        <input lang={lang.locale} value={term} onChange={(e) => setTerm(e.target.value)} autoCapitalize="off" className={field} />
      </label>
      {needsReading && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-2">Pinyin (opcional)</span>
          <input
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder="ni3 hao3"
            autoCapitalize="off"
            className={field}
          />
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">Significado en español</span>
        <input value={meaning} onChange={(e) => setMeaning(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">Nota (opcional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dónde la viste, un ejemplo..."
          className={field}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <Button type="submit" size="lg">
        Guardar
      </Button>
    </form>
  );
}
