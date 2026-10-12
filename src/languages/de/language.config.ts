import { lazy } from 'react';
import { buildContent } from '@/core/content/build';
import type { LanguagePack } from '@/core/types';
import { deArticlePlugin } from './exercises/Article';
import { deGapPlugin } from './exercises/Gap';
import { normalizeGerman } from './utils/normalize';

const de: LanguagePack = {
  id: 'de',
  name: 'Alemán',
  nativeName: 'Deutsch',
  glyph: 'De',
  flag: '🇩🇪',
  locale: 'de-DE',
  direction: 'ltr',
  script: 'latin',
  wordSeparator: ' ',
  features: { conjugation: true, gender: true, romanization: null },
  theme: {
    accent: 'oklch(0.5 0.12 250)',
    accentDark: 'oklch(0.76 0.11 250)',
    secondary: 'oklch(0.84 0.15 85)',
  },
  levels: [
    { id: 'A1', name: 'A1 · Principiante' },
    { id: 'A2', name: 'A2 · Básico' },
    { id: 'B1', name: 'B1 · Intermedio' },
  ],
  // una diéresis olvidada (schon/schön) cuenta como "casi correcto"
  answerCheck: { diacritics: 'lenient', typoTolerance: true },
  normalizeAnswer: normalizeGerman,
  loadContent: () =>
    buildContent({
      units: import.meta.glob('./content/units/*.json', { import: 'default' }),
      vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
      grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    }),
  exercises: [deArticlePlugin, deGapPlugin],
  tools: [
    {
      id: 'casos',
      title: 'Tabla de casos',
      description: 'Artículos, pronombres y terminaciones en nominativo, acusativo, dativo y genitivo.',
      Component: lazy(() => import('./tools/CasesTool')),
    },
    {
      id: 'verbos-irregulares',
      title: 'Verbos irregulares',
      description: 'Presente, Präteritum y Perfekt de los verbos fuertes más usados.',
      Component: lazy(() => import('./tools/StrongVerbsTool')),
    },
    {
      id: 'preposiciones',
      title: 'Preposiciones y casos',
      description: 'Qué caso pide cada preposición, con ejemplos.',
      Component: lazy(() => import('./tools/PrepositionsTool')),
    },
  ],
};

export default de;
