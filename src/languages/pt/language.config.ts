import { lazy } from 'react';
import { buildContent } from '@/core/content/build';
import type { LanguagePack } from '@/core/types';
import { ptConjugatePlugin } from './exercises/Conjugate';

const pt: LanguagePack = {
  id: 'pt',
  name: 'Portugués',
  nativeName: 'Português',
  glyph: 'Pt',
  flag: '🇧🇷',
  locale: 'pt-BR',
  direction: 'ltr',
  script: 'latin',
  wordSeparator: ' ',
  features: { conjugation: true, gender: true, romanization: null },
  theme: {
    accent: 'oklch(0.53 0.12 160)',
    accentDark: 'oklch(0.76 0.13 160)',
    secondary: 'oklch(0.86 0.15 95)',
  },
  levels: [
    { id: 'A1', name: 'A1 · Principiante' },
    { id: 'A2', name: 'A2 · Básico' },
    { id: 'B1', name: 'B1 · Intermedio' },
  ],
  answerCheck: { diacritics: 'lenient', typoTolerance: true },
  loadContent: () =>
    buildContent({
      units: import.meta.glob('./content/units/*.json', { import: 'default' }),
      vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
      grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    }),
  exercises: [ptConjugatePlugin],
  tools: [
    {
      id: 'conjugacion',
      title: 'Tabla de conjugación',
      description: 'Presente, pretéritos y futuro de los verbos más usados.',
      Component: lazy(() => import('./tools/ConjugationTool')),
    },
    {
      id: 'falsos-amigos',
      title: 'Falsos amigos',
      description: 'Palabras que se parecen al español pero significan otra cosa.',
      Component: lazy(() => import('./tools/FalseFriendsTool')),
    },
  ],
};

export default pt;
