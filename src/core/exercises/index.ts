import type { ExercisePlugin, LanguagePack } from '../types';
import { listenChoosePlugin } from './ListenChoose';
import { matchPairsPlugin } from './MatchPairs';
import { multipleChoicePlugin } from './MultipleChoice';
import { translateWritePlugin } from './TranslateWrite';
import { wordOrderPlugin } from './WordOrder';

export const CORE_PLUGINS: ExercisePlugin<any>[] = [
  multipleChoicePlugin,
  listenChoosePlugin,
  translateWritePlugin,
  wordOrderPlugin,
  matchPairsPlugin,
];

const core = new Map(CORE_PLUGINS.map((p) => [p.type, p]));

/** el motor solo conoce `type`: busca primero en el idioma, luego en el núcleo */
export function getPlugin(type: string, lang: LanguagePack): ExercisePlugin<any> | undefined {
  return lang.exercises?.find((p) => p.type === type) ?? core.get(type);
}
