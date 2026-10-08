import { PT_PERSONS, PT_TENSES } from '../exercises/schemas';

export type PtPerson = (typeof PT_PERSONS)[number];
export type PtTense = (typeof PT_TENSES)[number];

/** formas: [eu, você/ele/ela, nós, vocês/eles/elas] */
type Forms = [string, string, string, string];

export const TENSE_LABELS: Record<PtTense, string> = {
  presente: 'Presente',
  'preterito-perfeito': 'Pretérito perfeito',
  'preterito-imperfeito': 'Pretérito imperfeito',
  futuro: 'Futuro do presente',
};

const PERSON_SLOT: Record<PtPerson, 0 | 1 | 2 | 3> = {
  eu: 0,
  você: 1,
  'ele/ela': 1,
  nós: 2,
  vocês: 3,
  'eles/elas': 3,
};

const IRREGULAR: Record<string, Partial<Record<PtTense, Forms>>> = {
  ser: {
    presente: ['sou', 'é', 'somos', 'são'],
    'preterito-perfeito': ['fui', 'foi', 'fomos', 'foram'],
    'preterito-imperfeito': ['era', 'era', 'éramos', 'eram'],
  },
  estar: {
    presente: ['estou', 'está', 'estamos', 'estão'],
    'preterito-perfeito': ['estive', 'esteve', 'estivemos', 'estiveram'],
  },
  ter: {
    presente: ['tenho', 'tem', 'temos', 'têm'],
    'preterito-perfeito': ['tive', 'teve', 'tivemos', 'tiveram'],
    'preterito-imperfeito': ['tinha', 'tinha', 'tínhamos', 'tinham'],
  },
  ir: {
    presente: ['vou', 'vai', 'vamos', 'vão'],
    'preterito-perfeito': ['fui', 'foi', 'fomos', 'foram'],
  },
  fazer: {
    presente: ['faço', 'faz', 'fazemos', 'fazem'],
    'preterito-perfeito': ['fiz', 'fez', 'fizemos', 'fizeram'],
    futuro: ['farei', 'fará', 'faremos', 'farão'],
  },
  poder: {
    presente: ['posso', 'pode', 'podemos', 'podem'],
    'preterito-perfeito': ['pude', 'pôde', 'pudemos', 'puderam'],
  },
  querer: {
    presente: ['quero', 'quer', 'queremos', 'querem'],
    'preterito-perfeito': ['quis', 'quis', 'quisemos', 'quiseram'],
  },
  dizer: {
    presente: ['digo', 'diz', 'dizemos', 'dizem'],
    'preterito-perfeito': ['disse', 'disse', 'dissemos', 'disseram'],
    futuro: ['direi', 'dirá', 'diremos', 'dirão'],
  },
  ver: {
    presente: ['vejo', 'vê', 'vemos', 'veem'],
    'preterito-perfeito': ['vi', 'viu', 'vimos', 'viram'],
  },
  vir: {
    presente: ['venho', 'vem', 'vimos', 'vêm'],
    'preterito-perfeito': ['vim', 'veio', 'viemos', 'vieram'],
    'preterito-imperfeito': ['vinha', 'vinha', 'vínhamos', 'vinham'],
  },
  dar: {
    presente: ['dou', 'dá', 'damos', 'dão'],
    'preterito-perfeito': ['dei', 'deu', 'demos', 'deram'],
  },
  saber: {
    presente: ['sei', 'sabe', 'sabemos', 'sabem'],
    'preterito-perfeito': ['soube', 'soube', 'soubemos', 'souberam'],
  },
  pôr: {
    presente: ['ponho', 'põe', 'pomos', 'põem'],
    'preterito-perfeito': ['pus', 'pôs', 'pusemos', 'puseram'],
    'preterito-imperfeito': ['punha', 'punha', 'púnhamos', 'punham'],
    futuro: ['porei', 'porá', 'poremos', 'porão'],
  },
  trazer: {
    presente: ['trago', 'traz', 'trazemos', 'trazem'],
    'preterito-perfeito': ['trouxe', 'trouxe', 'trouxemos', 'trouxeram'],
    futuro: ['trarei', 'trará', 'traremos', 'trarão'],
  },
  ler: {
    presente: ['leio', 'lê', 'lemos', 'leem'],
  },
  ouvir: { presente: ['ouço', 'ouve', 'ouvimos', 'ouvem'] },
  pedir: { presente: ['peço', 'pede', 'pedimos', 'pedem'] },
  dormir: { presente: ['durmo', 'dorme', 'dormimos', 'dormem'] },
  perder: { presente: ['perco', 'perde', 'perdemos', 'perdem'] },
};

/** verbos que la herramienta ofrece por defecto (irregulares + regulares frecuentes) */
export const COMMON_VERBS: { verb: string; meaning: string }[] = [
  { verb: 'ser', meaning: 'ser' },
  { verb: 'estar', meaning: 'estar' },
  { verb: 'ter', meaning: 'tener' },
  { verb: 'ir', meaning: 'ir' },
  { verb: 'fazer', meaning: 'hacer' },
  { verb: 'poder', meaning: 'poder' },
  { verb: 'querer', meaning: 'querer' },
  { verb: 'dizer', meaning: 'decir' },
  { verb: 'ver', meaning: 'ver' },
  { verb: 'vir', meaning: 'venir' },
  { verb: 'dar', meaning: 'dar' },
  { verb: 'saber', meaning: 'saber' },
  { verb: 'pôr', meaning: 'poner' },
  { verb: 'trazer', meaning: 'traer' },
  { verb: 'ler', meaning: 'leer' },
  { verb: 'ouvir', meaning: 'oír, escuchar' },
  { verb: 'pedir', meaning: 'pedir' },
  { verb: 'dormir', meaning: 'dormir' },
  { verb: 'falar', meaning: 'hablar' },
  { verb: 'gostar', meaning: 'gustar (gostar de)' },
  { verb: 'morar', meaning: 'vivir (residir)' },
  { verb: 'trabalhar', meaning: 'trabajar' },
  { verb: 'estudar', meaning: 'estudiar' },
  { verb: 'comer', meaning: 'comer' },
  { verb: 'beber', meaning: 'beber' },
  { verb: 'aprender', meaning: 'aprender' },
  { verb: 'escrever', meaning: 'escribir' },
  { verb: 'abrir', meaning: 'abrir' },
  { verb: 'partir', meaning: 'partir, salir' },
  { verb: 'decidir', meaning: 'decidir' },
  { verb: 'ficar', meaning: 'quedarse, quedar' },
  { verb: 'chegar', meaning: 'llegar' },
  { verb: 'começar', meaning: 'empezar' },
  { verb: 'conhecer', meaning: 'conocer' },
];

function regular(verb: string, tense: PtTense): Forms | null {
  const m = verb.match(/^(.*)(ar|er|ir)$/);
  if (!m) return null;
  const [, stem, ending] = m;
  const v = ending[0] as 'a' | 'e' | 'i';

  switch (tense) {
    case 'presente': {
      let eu = `${stem}o`;
      if (ending === 'er' && stem.endsWith('c')) eu = `${stem.slice(0, -1)}ço`;
      if ((ending === 'er' || ending === 'ir') && stem.endsWith('g')) eu = `${stem.slice(0, -1)}jo`;
      const third = v === 'a' ? `${stem}a` : `${stem}e`;
      const nos = `${stem}${v}mos`;
      const plural = v === 'a' ? `${stem}am` : `${stem}em`;
      return [eu, third, nos, plural];
    }
    case 'preterito-perfeito': {
      if (v === 'a') {
        let eu = `${stem}ei`;
        if (stem.endsWith('c')) eu = `${stem.slice(0, -1)}quei`;
        else if (stem.endsWith('g')) eu = `${stem}uei`;
        else if (stem.endsWith('ç')) eu = `${stem.slice(0, -1)}cei`;
        return [eu, `${stem}ou`, `${stem}amos`, `${stem}aram`];
      }
      if (v === 'e') return [`${stem}i`, `${stem}eu`, `${stem}emos`, `${stem}eram`];
      return [`${stem}i`, `${stem}iu`, `${stem}imos`, `${stem}iram`];
    }
    case 'preterito-imperfeito': {
      if (v === 'a') return [`${stem}ava`, `${stem}ava`, `${stem}ávamos`, `${stem}avam`];
      return [`${stem}ia`, `${stem}ia`, `${stem}íamos`, `${stem}iam`];
    }
    case 'futuro': {
      return [`${verb}ei`, `${verb}á`, `${verb}emos`, `${verb}ão`];
    }
  }
}

export function conjugateAll(verb: string, tense: PtTense): Forms | null {
  const v = verb.trim().toLowerCase();
  return IRREGULAR[v]?.[tense] ?? (v === 'pôr' ? null : regular(v, tense));
}

export function conjugate(verb: string, person: PtPerson, tense: PtTense): string | null {
  const forms = conjugateAll(verb, tense);
  return forms ? forms[PERSON_SLOT[person]] : null;
}

export function isIrregular(verb: string): boolean {
  return verb.trim().toLowerCase() in IRREGULAR;
}

export { PT_PERSONS, PT_TENSES };
