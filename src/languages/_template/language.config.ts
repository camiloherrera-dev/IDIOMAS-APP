import { buildContent } from '@/core/content/build';
import type { LanguagePack } from '@/core/types';

/**
 * Plantilla de idioma. `npm run new-language <id> "<Nombre>" <locale>` copia esta carpeta
 * y reemplaza los marcadores __ID__, __NAME__, __NATIVE__ y __LOCALE__.
 * Las carpetas que empiezan por "_" no se registran en la app.
 */
const pack: LanguagePack = {
  id: '__ID__',
  name: '__NAME__',
  nativeName: '__NATIVE__',
  glyph: '__GLYPH__',
  flag: '',
  locale: '__LOCALE__',
  direction: 'ltr',
  script: 'latin',
  wordSeparator: ' ',
  features: { romanization: null },
  theme: {
    // elige un acento propio en OKLCH (claro y oscuro)
    accent: 'oklch(0.52 0.14 260)',
    accentDark: 'oklch(0.74 0.12 260)',
    secondary: 'oklch(0.8 0.12 80)',
  },
  levels: [
    { id: 'A1', name: 'A1 · Principiante' },
    { id: 'A2', name: 'A2 · Básico' },
  ],
  answerCheck: { diacritics: 'lenient', typoTolerance: true },
  loadContent: () =>
    buildContent({
      units: import.meta.glob('./content/units/*.json', { import: 'default' }),
      vocab: import.meta.glob('./content/vocab/*.json', { import: 'default' }),
      grammar: import.meta.glob<string>('./content/grammar/*.md', { query: '?raw', import: 'default' }),
    }),
  // exercises: [miPluginDeEjercicio],
  // tools: [{ id, title, description, Component: lazy(() => import('./tools/MiHerramienta')) }],
};

export default pack;
