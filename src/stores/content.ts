import { create } from 'zustand';
import type { LanguageContent } from '@/core/types';
import { db } from '@/db';
import { getLanguage } from '@/languages';

type Entry = { status: 'loading' } | { status: 'ready'; content: LanguageContent } | { status: 'error'; error: string };

interface ContentState {
  byLang: Record<string, Entry>;
  load: (langId: string) => Promise<LanguageContent | undefined>;
}

/**
 * El curso cambió los ids de algunas lecciones (gramática, escucha, repaso): el progreso
 * guardado con el id anterior pasa al nuevo. Es idempotente.
 */
export async function migrateLessonIds(langId: string, map: Record<string, string> | undefined, database = db) {
  if (!map || !Object.keys(map).length) return 0;
  const rows = (await database.lessonProgress.where('langId').equals(langId).toArray()).filter((r) => map[r.lessonId]);
  if (!rows.length) return 0;
  await database.transaction('rw', database.lessonProgress, async () => {
    for (const r of rows) {
      const id = map[r.lessonId];
      const cur = await database.lessonProgress.get(id);
      if (!cur || r.completedAt > cur.completedAt)
        await database.lessonProgress.put({ ...r, lessonId: id, bestScore: Math.max(r.bestScore, cur?.bestScore ?? 0) });
      await database.lessonProgress.delete(r.lessonId);
    }
  });
  return rows.length;
}

const inflight = new Map<string, Promise<LanguageContent | undefined>>();

export const useContentStore = create<ContentState>((set, get) => ({
  byLang: {},
  load: (langId) => {
    const entry = get().byLang[langId];
    if (entry?.status === 'ready') return Promise.resolve(entry.content);
    const pending = inflight.get(langId);
    if (pending) return pending;

    const lang = getLanguage(langId);
    if (!lang) return Promise.resolve(undefined);
    set((s) => ({ byLang: { ...s.byLang, [langId]: { status: 'loading' } } }));
    // un reintento: en redes móviles o justo después de un despliegue, un trozo puede fallar una vez
    const loadOnce = () => lang.loadContent();
    const p = loadOnce()
      .catch(() => new Promise<void>((r) => setTimeout(r, 600)).then(loadOnce))
      .then(async (content) => {
        await migrateLessonIds(langId, content.legacyLessons).catch(() => {});
        set((s) => ({ byLang: { ...s.byLang, [langId]: { status: 'ready', content } } }));
        return content;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[contenido ${langId}]`, err);
        set((s) => ({ byLang: { ...s.byLang, [langId]: { status: 'error', error: message } } }));
        return undefined;
      })
      .finally(() => inflight.delete(langId));
    inflight.set(langId, p);
    return p;
  },
}));
