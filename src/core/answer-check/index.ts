import type { AnswerCheckOptions, CheckResult } from '../types';

const PUNCTUATION = /[\p{P}\p{S}]/gu;

/** minúsculas, NFC, sin puntuación y con espacios colapsados */
export function normalize(input: string): string {
  return input.normalize('NFC').toLowerCase().replace(/[’`´]/g, "'").replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
}

/** quita tildes, cedillas y marcas de tono */
export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

const DEFAULT_OPTIONS: AnswerCheckOptions = { diacritics: 'lenient', typoTolerance: true };

/**
 * Compara texto libre contra una lista de respuestas válidas.
 * `langNormalize` se aplica a ambos lados (p. ej. pinyin con números → marcas).
 */
export function checkText(
  input: string,
  answers: string[],
  options: AnswerCheckOptions = DEFAULT_OPTIONS,
  langNormalize: (s: string) => string = (s) => s,
): CheckResult {
  const prep = (s: string) => normalize(langNormalize(normalize(s)));
  const given = prep(input);
  const solution = answers[0];
  if (!given) return { correct: false, solution };

  const candidates = answers.map((a) => ({ raw: a, norm: prep(a) }));
  // Comparación también sin espacios: "nihao" == "ni hao", "我是" == "我 是"
  const compact = (s: string) => s.replace(/\s/g, '');

  for (const c of candidates) {
    if (c.norm === given || compact(c.norm) === compact(given)) return { correct: true, solution: c.raw };
  }

  for (const c of candidates) {
    if (compact(stripDiacritics(c.norm)) === compact(stripDiacritics(given))) {
      if (options.diacritics === 'lenient') {
        return { correct: true, partial: true, solution: c.raw, feedback: 'Casi: revisa las tildes.' };
      }
      return {
        correct: false,
        solution: c.raw,
        feedback: options.diacriticsFeedback ?? 'Revisa las tildes.',
      };
    }
  }

  if (options.typoTolerance) {
    for (const c of candidates) {
      const a = stripDiacritics(c.norm);
      const b = stripDiacritics(given);
      if (a.length >= 6 && levenshtein(a, b) <= 1) {
        return { correct: true, partial: true, solution: c.raw, feedback: 'Casi: tienes un error de escritura.' };
      }
    }
  }

  return { correct: false, solution };
}
