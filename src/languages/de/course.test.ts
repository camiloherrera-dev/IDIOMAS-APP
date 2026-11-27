import { beforeAll, describe, expect, it } from 'vitest';
import { buildContent } from '@/core/content/build';
import { CORE_PLUGINS } from '@/core/exercises';
import { buildLessonSession, flattenLessons, termMap } from '@/core/lessons';
import { seeded } from '@/core/lessons/random';
import { parseSentence } from '@/core/lessons/sentences';
import type { LanguageContent } from '@/core/types';
import de from './language.config';

let content: LanguageContent;
const plugins = new Map([...CORE_PLUGINS, ...(de.exercises ?? [])].map((p) => [p.type, p]));

beforeAll(async () => {
  content = await buildContent({
    units: import.meta.glob('./content/units/*.json', { import: 'default' }),
    vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
    grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    legacy: () => import('./content/legacy.json').then((m) => m.default),
    legacyLessons: () => import('./content/legacy-lessons.json').then((m) => m.default),
  });
});

describe('curso de alemán', () => {
  it('las unidades van en orden de nivel', () => {
    const order = de.levels.map((l) => l.id);
    const ranks = content.units.map((u) => order.indexOf(u.level));
    expect(ranks.every((r) => r >= 0)).toBe(true);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('todas las lecciones generan una sesión válida', () => {
    const empty: string[] = [];
    for (const ref of flattenLessons(content)) {
      const items = buildLessonSession(ref.lesson, content, { introduce: true, lang: de, rand: seeded(3) });
      const exercises = items.filter((i) => i.kind === 'exercise');
      if (exercises.length < (ref.lesson.kind === 'reading' ? 2 : 4)) empty.push(`${ref.lesson.id} (${exercises.length})`);
      for (const item of exercises) {
        if (item.kind !== 'exercise') continue;
        const plugin = plugins.get(item.data.type);
        expect(plugin, `${ref.lesson.id}: ${item.data.type}`).toBeDefined();
        const r = plugin!.schema.safeParse(item.data);
        expect(r.success, `${ref.lesson.id}: ${JSON.stringify(item.data).slice(0, 200)}`).toBe(true);
        const d = item.data as { options?: string[]; answer?: number };
        if (Array.isArray(d.options) && typeof d.answer === 'number') {
          expect(d.answer, ref.lesson.id).toBeLessThan(d.options.length);
          expect(new Set(d.options).size, `${ref.lesson.id}: ${d.options.join('|')}`).toBe(d.options.length);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it('cada palabra se enseña en alguna lección y los sustantivos con artículo llevan género y plural', () => {
    const taught = new Set(content.units.flatMap((u) => u.lessons.flatMap((l) => l.vocab)));
    expect(content.vocab.filter((t) => !taught.has(t.id)).map((t) => t.term)).toEqual([]);
    const bad = content.vocab.filter((t) => {
      const x = (t.extra ?? {}) as { gender?: string; plural?: string };
      // los países e idiomas se usan sin artículo y pueden ir sin él
      return t.pos === 'sustantivo' && /^(der|die|das) /.test(t.term) && (!x.gender || !x.plural);
    });
    expect(bad.map((t) => t.term)).toEqual([]);
  });

  it('las frases llevan palabra foco', () => {
    for (const { lesson } of flattenLessons(content))
      for (const s of lesson.sentences)
        expect(
          parseSentence(s).some((t) => t.focus),
          `${lesson.id}: ${s.text}`,
        ).toBe(true);
  });

  it('las lecciones del curso escrito a mano conservan su id o tienen equivalente', () => {
    const ids = new Set(flattenLessons(content).map((r) => r.lesson.id));
    const old = Array.from({ length: 18 }, (_, u) =>
      [1, 2, 3].map((l) => `de-u${String(u + 1).padStart(2, '0')}-l${String(l).padStart(2, '0')}`),
    ).flat();
    const lost = old.filter((id) => !ids.has(id) && !ids.has(content.legacyLessons?.[id] ?? ''));
    expect(lost).toEqual([]);
    const map = termMap(content);
    for (const o of Object.keys(content.legacy ?? {})) expect(map.get(o), o).toBeDefined();
  });

  it('las guías enlazadas existen', () => {
    const guides = new Set(content.guides.map((g) => g.id));
    for (const { lesson } of flattenLessons(content)) {
      if (lesson.intro) expect(guides.has(lesson.intro), lesson.id).toBe(true);
      if (lesson.skill) expect(guides.has(lesson.skill), `${lesson.id}: ${lesson.skill}`).toBe(true);
    }
  });
});
