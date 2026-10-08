import { useEffect, useState } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LanguagePack } from '@/core/types';

interface Radical {
  radical: string;
  name: string;
  pinyin: string;
  meaning: string;
  examples: string[];
}

export default function RadicalsTool({ lang }: { lang: LanguagePack }) {
  const [items, setItems] = useState<Radical[] | null>(null);

  useEffect(() => {
    void import('../content/radicals.json').then((m) => setItems(m.default as Radical[]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-2">
        Muchos caracteres se forman con piezas que se repiten. Reconocerlas te da pistas del significado y hace más fácil
        memorizar.
      </p>
      {!items ? (
        <div className="grid grid-cols-2 gap-3" role="status" aria-label="Cargando">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((r) => (
            <li key={r.radical} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between">
                <span lang="zh-CN" className="font-han text-4xl leading-none text-accent">
                  {r.radical}
                </span>
                <SpeakButton
                  text={r.examples[0] ?? r.radical}
                  locale={lang.locale}
                  size="sm"
                  label={`Escuchar ${r.examples[0] ?? r.radical}`}
                />
              </div>
              <div>
                <p className="font-semibold">{r.meaning}</p>
                <p className="text-xs text-ink-3">{r.pinyin}</p>
              </div>
              <p lang="zh-CN" className="font-han text-lg tracking-[0.2em] text-ink-2">
                {r.examples.join('')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
