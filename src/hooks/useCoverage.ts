import { useLiveQuery } from 'dexie-react-hooks';
import { coverageOf, termsInDeck, type Coverage } from '@/core/srs';
import type { LanguageContent, LanguagePack } from '@/core/types';

export interface LevelCoverage extends Coverage {
  level: string;
  label: string;
}

/** cobertura del vocabulario oficial por nivel (p. ej. HSK): cuántas palabras hay en el mazo y cuántas se saben */
export function useCoverage(lang: LanguagePack | undefined, content: LanguageContent | undefined): LevelCoverage[] | undefined {
  return useLiveQuery(async () => {
    if (!lang?.coverage || !content) return [];
    const deck = await termsInDeck(lang.id, content.legacy);
    return lang.coverage.map(({ level, label }) => ({
      level,
      label,
      ...coverageOf(
        content.vocab.filter((t) => t.level === level).map((t) => t.id),
        deck,
      ),
    }));
  }, [lang?.id, content]);
}
