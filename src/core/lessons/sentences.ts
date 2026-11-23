import type { LanguagePack, Sentence } from '../types';

/** puntuación que puede ir pegada a una palabra dentro de una frase */
const EDGE = /^[\s，。！？、；：,.!?;:"“”«»()（）…—-]+|[\s，。！？、；：,.!?;:"“”«»()（）…—-]+$/g;

export interface SentenceToken {
  /** tal como se escribe, con su puntuación ("下雨，") */
  text: string;
  /** solo la palabra ("下雨") */
  word: string;
  focus: boolean;
}

export function parseSentence(s: Pick<Sentence, 'text'>): SentenceToken[] {
  return s.text
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const focus = raw.includes('[');
      const text = raw.replace(/[[\]]/g, '');
      return { text, word: text.replace(EDGE, ''), focus };
    })
    .filter((t) => t.text.length > 0);
}

/** la frase tal como se lee, sin corchetes y con el separador del idioma */
export function plainSentence(s: Pick<Sentence, 'text'>, lang: Pick<LanguagePack, 'wordSeparator'>): string {
  return parseSentence(s)
    .map((t) => t.text)
    .join(lang.wordSeparator);
}

/** la frase con un hueco en la posición `index` */
export function gapSentence(tokens: SentenceToken[], index: number, lang: Pick<LanguagePack, 'wordSeparator'>): string {
  return tokens
    .map((t, i) => (i === index ? t.text.replace(t.word, lang.wordSeparator === '' ? '＿＿' : '____') : t.text))
    .join(lang.wordSeparator);
}
