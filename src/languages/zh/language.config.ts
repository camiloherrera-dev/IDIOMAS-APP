import { lazy } from 'react';
import { buildContent } from '@/core/content/build';
import type { LanguagePack } from '@/core/types';
import { Hanzi } from './components/Hanzi';
import { zhTonePlugin } from './exercises/Tone';
import { normalizeZhAnswer } from './utils/pinyin';

const zh: LanguagePack = {
  id: 'zh',
  name: 'Chino mandarín',
  nativeName: '中文',
  glyph: '中',
  flag: '🇨🇳',
  locale: 'zh-CN',
  direction: 'ltr',
  script: 'hanzi',
  wordSeparator: '',
  features: { tones: true, characters: true, romanization: 'pinyin' },
  theme: {
    accent: 'oklch(0.54 0.18 29)',
    accentDark: 'oklch(0.72 0.15 32)',
    secondary: 'oklch(0.8 0.13 85)',
  },
  levels: [
    { id: 'HSK1', name: 'HSK 1' },
    { id: 'HSK2', name: 'HSK 2' },
    { id: 'HSK3', name: 'HSK 3' },
  ],
  answerCheck: {
    diacritics: 'strict',
    diacriticsFeedback: 'Las sílabas están bien, pero revisa los tonos.',
    typoTolerance: false,
  },
  normalizeAnswer: normalizeZhAnswer,
  renderTerm: Hanzi,
  termDetail: lazy(() => import('./components/TermStrokes')),
  loadContent: async () => {
    // la fuente CJK (cientos de subconjuntos) solo se carga si se estudia chino
    void import('./fonts');
    return buildContent({
      units: import.meta.glob('./content/units/*.json', { import: 'default' }),
      vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
      grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    });
  },
  exercises: [zhTonePlugin],
  tools: [
    {
      id: 'tonos',
      title: 'Entrenador de tonos',
      description: 'Escucha y distingue mā, má, mǎ, mà con pares mínimos.',
      Component: lazy(() => import('./tools/ToneTrainerTool')),
    },
    {
      id: 'trazos',
      title: 'Orden de trazos',
      description: 'Mira cómo se escribe un carácter y practica con el dedo.',
      Component: lazy(() => import('./tools/StrokeTool')),
    },
    {
      id: 'radicales',
      title: 'Radicales',
      description: 'Las piezas que se repiten dentro de los caracteres.',
      Component: lazy(() => import('./tools/RadicalsTool')),
    },
  ],
};

export default zh;
