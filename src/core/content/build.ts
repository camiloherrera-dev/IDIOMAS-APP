import { guideFrontmatterSchema, termSchema, unitSchema } from '../schema';
import type { Guide, LanguageContent } from '../types';
import { idFromPath, parseFrontmatter } from './frontmatter';

type Loader<T> = Record<string, () => Promise<T>>;

export interface ContentSources {
  units: Loader<unknown>;
  vocab: Loader<unknown>;
  grammar: Loader<string>;
}

const byPath = <T>(loader: Loader<T>) =>
  Promise.all(
    Object.entries(loader)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, load]) => [path, await load()] as const),
  );

/** carga perezosa + validación del contenido de un paquete de idioma */
export async function buildContent(sources: ContentSources): Promise<LanguageContent> {
  const [units, vocab, grammar] = await Promise.all([byPath(sources.units), byPath(sources.vocab), byPath(sources.grammar)]);

  const guides: Guide[] = grammar.map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw);
    const fm = guideFrontmatterSchema.parse(data);
    return { id: idFromPath(path), title: fm.title, summary: fm.summary, level: fm.level, order: fm.order ?? 999, body };
  });
  guides.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  return {
    units: units.map(([, u]) => unitSchema.parse(u)),
    vocab: vocab.flatMap(([, list]) => termSchema.array().parse(list)),
    guides,
  };
}
