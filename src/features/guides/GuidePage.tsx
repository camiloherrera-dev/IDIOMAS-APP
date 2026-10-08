import { ArrowLeft } from '@phosphor-icons/react';
import { marked } from 'marked';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SpeakButton } from '@/components/SpeakButton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import type { LanguagePack } from '@/core/types';
import { useActiveLanguage } from '@/hooks/useLanguage';

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

export function GuidePage() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const { lang, content } = useActiveLanguage();
  const guide = content?.guides.find((g) => g.id === guideId);
  const blocks = useMemo(() => (guide ? parseGuide(guide.body) : []), [guide]);

  if (!lang || !content) return <ScreenSkeleton />;
  if (!guide) {
    return (
      <EmptyState
        icon={<ArrowLeft size={26} />}
        title="Guía no encontrada"
        body="Esta guía no existe en el idioma activo."
        action={<Button onClick={() => navigate('/guias')}>Ver guías</Button>}
      />
    );
  }

  return (
    <article>
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-3 pb-1 backdrop-blur-lg">
        <IconButton label="Volver" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
      </header>
      <div className="px-5 pb-8">
        {guide.level && <p className="text-sm font-semibold text-accent">{guide.level}</p>}
        <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-balance">{guide.title}</h1>
        <p className="mt-2 text-lg text-ink-2">{guide.summary}</p>
        <div className="prose-guide mt-6">
          {blocks.map((b, i) =>
            b.kind === 'md' ? (
              <div key={i} dangerouslySetInnerHTML={{ __html: b.html }} />
            ) : (
              <Examples key={i} rows={b.rows} lang={lang} />
            ),
          )}
        </div>
      </div>
    </article>
  );
}
