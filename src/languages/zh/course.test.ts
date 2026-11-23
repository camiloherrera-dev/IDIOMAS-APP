import { beforeAll, describe, expect, it } from 'vitest';
import { buildContent } from '@/core/content/build';
import { CORE_PLUGINS } from '@/core/exercises';
import {
  buildLessonSession,
  buildLevelTest,
  buildSkillSession,
  flattenLessons,
  isUnlocked,
  lessonsForSkill,
  nextLesson,
  termMap,
  termsOfLevel,
} from '@/core/lessons';
import { seeded } from '@/core/lessons/random';
import { parseSentence } from '@/core/lessons/sentences';
import type { LanguageContent } from '@/core/types';
import zh from './language.config';

let content: LanguageContent;
const plugins = new Map([...CORE_PLUGINS, ...(zh.exercises ?? [])].map((p) => [p.type, p]));

beforeAll(async () => {
  content = await buildContent({
    units: import.meta.glob('./content/units/*.json', { import: 'default' }),
    vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
    grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    legacy: () => import('./content/legacy.json').then((m) => m.default),
  });
});

describe('curso de chino', () => {
  it('cubre las listas oficiales HSK 1 a 4', () => {
    const sizes = ['HSK1', 'HSK2', 'HSK3', 'HSK4'].map((lv) => termsOfLevel(content, lv).length);
    expect(sizes[0]).toBeGreaterThanOrEqual(300);
    expect(sizes[1]).toBeGreaterThanOrEqual(200);
    expect(sizes[2]).toBeGreaterThanOrEqual(500);
    expect(sizes[3]).toBeGreaterThanOrEqual(1000);
  });

  it('cada palabra de las listas se enseña en alguna lección', () => {
    const taught = new Set(content.units.flatMap((u) => u.lessons.flatMap((l) => l.vocab)));
    const missing = content.vocab.filter((t) => /^zh-w-/.test(t.id) && !taught.has(t.id));
    expect(missing.map((t) => t.term)).toEqual([]);
  });

  it('todas las lecciones generan una sesión válida', () => {
    const empty: string[] = [];
    for (const ref of flattenLessons(content)) {
      const items = buildLessonSession(ref.lesson, content, { introduce: true, lang: zh, rand: seeded(3) });
      const exercises = items.filter((i) => i.kind === 'exercise');
      if (exercises.length < 4) empty.push(`${ref.lesson.id} (${exercises.length})`);
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

  it('las frases marcan palabras que existen', () => {
    const words = new Set(content.vocab.map((t) => t.term));
    const bad: string[] = [];
    for (const { lesson } of flattenLessons(content)) {
      if (lesson.kind !== 'vocab') continue;
      for (const s of lesson.sentences)
        for (const tok of parseSentence(s)) if (tok.focus && !words.has(tok.word)) bad.push(`${lesson.id}: ${tok.word}`);
    }
    expect(bad).toEqual([]);
  });

  it('los ids antiguos siguen resolviendo a un término', () => {
    const map = termMap(content);
    for (const old of Object.keys(content.legacy ?? {})) expect(map.get(old), old).toBeDefined();
  });

  it('cada nivel empieza desbloqueado y el resto sigue el orden', () => {
    const all = flattenLessons(content);
    const none = new Set<string>();
    const firstOfH3 = all.find((r) => r.lesson.level === 'HSK3')!;
    const secondOfH3 = all[all.indexOf(firstOfH3) + 1];
    expect(isUnlocked(firstOfH3, all, none)).toBe(true);
    expect(isUnlocked(secondOfH3, all, none)).toBe(false);
    expect(isUnlocked(secondOfH3, all, new Set([firstOfH3.lesson.id]))).toBe(true);
    // tras completar una lección de HSK 3, la siguiente sugerida continúa ahí y no vuelve a HSK 1
    expect(nextLesson(content, new Set([firstOfH3.lesson.id]), firstOfH3.lesson.id)?.lesson.id).toBe(secondOfH3.lesson.id);
    expect(nextLesson(content, none)?.lesson.level).toBe('HSK1');
  });

  it('la prueba de nivel y el refuerzo de un punto débil tienen ejercicios', () => {
    expect(buildLevelTest(content, 'HSK2', zh, 25, seeded(1)).length).toBe(25);
    for (const skill of ['conectores-cambio', 'ba-oracion', 'numeros-escucha', 'cortesia-respuestas']) {
      expect(lessonsForSkill(content, skill).length, skill).toBeGreaterThan(0);
      expect(buildSkillSession(content, skill, zh, 10, seeded(2)).length, skill).toBeGreaterThanOrEqual(6);
    }
  });

  it('las lecciones de gramática apuntan a una guía existente', () => {
    const guides = new Set(content.guides.map((g) => g.id));
    for (const { lesson } of flattenLessons(content)) {
      if (lesson.intro) expect(guides.has(lesson.intro), lesson.id).toBe(true);
      if (lesson.skill) expect(guides.has(lesson.skill), `${lesson.id}: ${lesson.skill}`).toBe(true);
    }
  });
});
