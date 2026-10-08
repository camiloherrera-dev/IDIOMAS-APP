import { HandPointing, Play, WifiSlash } from '@phosphor-icons/react';
import HanziWriter from 'hanzi-writer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { LanguagePack } from '@/core/types';
import { useContentStore } from '@/stores/content';

type Mode = 'idle' | 'animating' | 'quiz' | 'done';

/** hanzi-writer solo entiende hex/rgb: resolvemos el token CSS (oklch) a rgb pintando 1px */
function cssVarToRgb(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!value || !ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/** orden de trazos con hanzi-writer; los datos se descargan por carácter y quedan en caché offline */
export function StrokeCanvas({ char, size = 260 }: { char: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState(false);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    setError(false);
    setMode('idle');
    const ink = cssVarToRgb('--c-ink', '#222');
    const accent = cssVarToRgb('--c-accent', '#c33');
    const line = cssVarToRgb('--c-line', '#ddd');
    writer.current = HanziWriter.create(ref.current, char, {
      width: size,
      height: size,
      padding: 12,
      strokeColor: ink,
      radicalColor: accent,
      outlineColor: line,
      highlightColor: accent,
      drawingColor: ink,
      strokeAnimationSpeed: 1.1,
      delayBetweenStrokes: 220,
      showCharacter: true,
      onLoadCharDataError: () => setError(true),
    });
    return () => {
      writer.current = null;
    };
  }, [char, size]);

  const animate = () => {
    setMode('animating');
    void writer.current?.animateCharacter({ onComplete: () => setMode('idle') });
  };

  const quiz = () => {
    setMode('quiz');
    setMistakes(0);
    void writer.current?.quiz({
      onMistake: () => setMistakes((m) => m + 1),
      onComplete: () => setMode('done'),
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative rounded-[var(--radius-card)] bg-surface hairline"
        style={{
          width: size,
          height: size,
          backgroundImage:
            'linear-gradient(var(--c-line) 1px, transparent 1px), linear-gradient(90deg, var(--c-line) 1px, transparent 1px)',
          backgroundSize: `${size / 2}px ${size / 2}px`,
          backgroundPosition: 'center',
        }}
      >
        <div ref={ref} lang="zh-CN" aria-label={`Carácter ${char}`} role="img" className="touch-none" />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-surface px-6 text-center text-sm text-ink-2">
            <WifiSlash size={28} />
            No hay datos de trazos para «{char}». Necesitas conexión la primera vez que abres un carácter.
          </div>
        )}
      </div>
      <p className="min-h-5 text-sm text-ink-2" aria-live="polite">
        {mode === 'quiz' && `Dibuja el carácter trazo a trazo${mistakes ? ` (${mistakes} fallos)` : ''}`}
        {mode === 'done' && (mistakes === 0 ? 'Perfecto, sin fallos.' : `Completado con ${mistakes} fallos.`)}
      </p>
      <div className="grid w-full grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={animate} disabled={error || mode === 'animating'}>
          <Play size={18} weight="fill" />
          Ver trazos
        </Button>
        <Button onClick={quiz} disabled={error}>
          <HandPointing size={18} weight="fill" />
          Practicar
        </Button>
      </div>
    </div>
  );
}

export default function StrokeTool({ lang }: { lang: LanguagePack }) {
  const entry = useContentStore((s) => s.byLang[lang.id]);
  const chars = useMemo(() => {
    if (entry?.status !== 'ready') return ['你', '好', '我', '是', '中', '国'];
    const set = new Set<string>();
    for (const t of entry.content.vocab) for (const c of t.term) if (/\p{Script=Han}/u.test(c)) set.add(c);
    return [...set];
  }, [entry]);
  const [char, setChar] = useState(chars[0]);
  const [custom, setCustom] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <StrokeCanvas char={char} size={Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 80 : 280)} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = [...custom].find((x) => /\p{Script=Han}/u.test(x));
          if (c) setChar(c);
          setCustom('');
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Otro carácter</span>
          <input
            lang="zh-CN"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Escribe un carácter"
            className="h-12 w-full rounded-[var(--radius-control)] bg-surface px-4 text-ink outline-none hairline placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
          />
        </label>
        <Button type="submit" variant="secondary">
          Ver
        </Button>
      </form>

      <section aria-labelledby="chars-curso">
        <h2 id="chars-curso" className="mb-3 text-sm font-semibold text-ink-2">
          Caracteres del curso
        </h2>
        <div className="grid grid-cols-6 gap-2">
          {chars.map((c) => (
            <button
              key={c}
              type="button"
              lang="zh-CN"
              onClick={() => setChar(c)}
              aria-pressed={c === char}
              className={cn(
                'pressable font-han flex aspect-square items-center justify-center rounded-[0.8rem] text-xl',
                c === char ? 'bg-accent text-accent-ink' : 'bg-surface hairline',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
