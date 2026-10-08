import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import type { Term } from '@/core/types';
import { StrokeCanvas } from '../tools/StrokeTool';

/** orden de trazos de cada carácter de una palabra, para la ficha del diccionario */
export default function TermStrokes({ term }: { term: Pick<Term, 'term'> }) {
  const chars = [...term.term].filter((c) => /\p{Script=Han}/u.test(c));
  const [current, setCurrent] = useState(chars[0]);
  if (!current) return null;

  return (
    <section aria-label="Orden de trazos">
      {chars.length > 1 && (
        <div className="mb-3 flex gap-2">
          {chars.map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              lang="zh-CN"
              aria-pressed={c === current}
              onClick={() => setCurrent(c)}
              className={cn(
                'pressable font-han size-11 rounded-[0.8rem] text-xl',
                c === current ? 'bg-accent text-accent-ink' : 'bg-sunken',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <StrokeCanvas char={current} size={220} />
    </section>
  );
}
