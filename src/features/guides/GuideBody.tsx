import { marked } from 'marked';
import { useMemo } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import type { LanguagePack } from '@/core/types';

type Block = { kind: 'md'; html: string } | { kind: 'examples'; rows: { text: string; reading?: string; translation: string }[] };

/** separa el Markdown de los bloques ```ejemplos (que se renderizan con audio) */
export function parseGuide(body: string): Block[] {
  const blocks: Block[] = [];
  const re = /```ejemplos\n([\s\S]*?)```/g;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const before = body.slice(last, m.index);
    if (before.trim()) blocks.push({ kind: 'md', html: marked.parse(before, { async: false }) });
    const rows = m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split('|').map((p) => p.trim());
        return parts.length >= 3
          ? { text: parts[0], reading: parts[1], translation: parts.slice(2).join(' | ') }
          : { text: parts[0], translation: parts[1] ?? '' };
      });
    blocks.push({ kind: 'examples', rows });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = body.slice(last);
  if (rest.trim()) blocks.push({ kind: 'md', html: marked.parse(rest, { async: false }) });
  return blocks;
}

function Examples({ rows, lang }: { rows: Extract<Block, { kind: 'examples' }>['rows']; lang: LanguagePack }) {
  return (
    <ul className="my-4 grid gap-2">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-3">
          <SpeakButton text={r.text} locale={lang.locale} size="sm" />
          <div className="min-w-0 pt-0.5">
            <p lang={lang.locale} className="leading-snug font-semibold text-ink">
              {r.text}
            </p>
            {r.reading && <p className="text-sm text-ink-2">{r.reading}</p>}
            <p className="text-sm text-ink-2">{r.translation}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** cuerpo de una guía: Markdown + bloques de ejemplos con audio */
export function GuideBody({ body, lang, className }: { body: string; lang: LanguagePack; className?: string }) {
  const blocks = useMemo(() => parseGuide(body), [body]);
  return (
    <div className={className ? `prose-guide ${className}` : 'prose-guide'}>
      {blocks.map((b, i) =>
        b.kind === 'md' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />
        ) : (
          <Examples key={i} rows={b.rows} lang={lang} />
        ),
      )}
    </div>
  );
}
