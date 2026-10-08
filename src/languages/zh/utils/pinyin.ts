const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const MARK_TO_TONE = new Map<string, number>();
for (const marks of Object.values(TONE_MARKS)) marks.forEach((m, i) => MARK_TO_TONE.set(m, i + 1));

/** "ni3 hao3" → "nǐ hǎo"; "lv4" → "lǜ"; "ni3hao3" → "nǐhǎo"; tono 5/0 = neutro (sin marca) */
export function numberedToMarked(input: string): string {
  const withU = input.replace(/v/g, 'ü').replace(/u:/g, 'ü');
  return withU.replace(/([a-zü]+)([0-5])/gi, (_, syl: string, tone: string) => applyTone(syl, Number(tone)));
}

/** tono (1-5) de una sílaba con marcas */
export function toneOf(syllable: string): 1 | 2 | 3 | 4 | 5 {
  for (const ch of syllable) {
    const t = MARK_TO_TONE.get(ch);
    if (t) return t as 1 | 2 | 3 | 4;
  }
  return 5;
}

/** quita la marca de tono de una sílaba: "hǎo" → "hao" */
export function toneless(syllable: string): string {
  // solo marcas de tono (macr\u00f3n, agudo, car\u00f3n, grave); la di\u00e9resis de \u00fc se conserva
  return syllable
    .normalize('NFD')
    .replace(/[\u0304\u0301\u030c\u0300]/g, '')
    .normalize('NFC');
}

/** aplica un tono a una sílaba sin marcas siguiendo la regla a/e > ou > última vocal */
export function applyTone(syllable: string, tone: number): string {
  const base = toneless(syllable);
  if (tone < 1 || tone > 4) return base;
  const lower = base.toLowerCase();
  let idx = lower.search(/[ae]/);
  if (idx === -1) idx = lower.indexOf('ou');
  if (idx === -1) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx === -1) return base;
  const vowel = lower[idx];
  return base.slice(0, idx) + TONE_MARKS[vowel][tone - 1] + base.slice(idx + 1);
}

/** normalizador de respuestas para el paquete zh */
export function normalizeZhAnswer(s: string): string {
  return /\d/.test(s) ? numberedToMarked(s) : s;
}

export const TONE_NAMES: Record<number, string> = {
  1: 'Primer tono (alto y plano)',
  2: 'Segundo tono (sube)',
  3: 'Tercer tono (baja y sube)',
  4: 'Cuarto tono (cae)',
  5: 'Tono neutro',
};
