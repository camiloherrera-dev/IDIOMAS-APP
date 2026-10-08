import type { LanguagePack } from '@/core/types';

/**
 * Registro automático: cada carpeta con `language.config.ts` es un idioma.
 * Las carpetas que empiezan por "_" (plantilla) se ignoran.
 */
const modules = import.meta.glob<{ default: LanguagePack }>('./[!_]*/language.config.ts', { eager: true });

export const languages: LanguagePack[] = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const byId = new Map(languages.map((l) => [l.id, l]));

export function getLanguage(id: string | undefined): LanguagePack | undefined {
  return id ? byId.get(id) : undefined;
}
