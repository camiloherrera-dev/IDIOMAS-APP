/** números en chino hablado (0 a 99.999), usando 两 donde se dice así (两百, 两千, 两万) */
const D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function below10000(n: number, liang: boolean): string {
  const q = Math.floor(n / 1000);
  const b = Math.floor((n % 1000) / 100);
  const s = Math.floor((n % 100) / 10);
  const g = n % 10;
  let out = '';
  if (q) out += (q === 2 && liang ? '两' : D[q]) + '千';
  if (b) out += (b === 2 && liang && !q ? '两' : D[b]) + '百';
  else if (q && (s || g)) out += '零';
  if (s) out += (s === 1 && !q && !b ? '' : D[s]) + '十';
  else if (b && g) out += '零';
  if (g) out += D[g];
  return out;
}

export function toChinese(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99999) throw new Error(`fuera de rango: ${n}`);
  if (n === 0) return D[0];
  const wan = Math.floor(n / 10000);
  const rest = n % 10000;
  let out = wan ? (wan === 2 ? '两' : D[wan]) + '万' : '';
  if (rest) out += (wan && rest < 1000 ? '零' : '') + below10000(rest, true);
  return out;
}

/** cantidad ante un clasificador: 2 se dice 两 (两斤, 两个, 两点) */
export function counted(n: number): string {
  return n === 2 ? '两' : toChinese(n);
}

export interface NumberDrill {
  kind: 'hora' | 'precio' | 'descuento' | 'vuelto' | 'cantidad' | 'cifra';
  /** lo que se oye */
  audio: string;
  /** pregunta en español */
  question: string;
  options: string[];
  answer: number;
  /** por qué, en una línea */
  why: string;
}

type Rand = () => number;
const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(rand: Rand, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const hhmm = (h: number, m: number) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;

function choices(rand: Rand, correct: string, wrong: string[]): { options: string[]; answer: number } {
  const set = [...new Set(wrong.filter((w) => w !== correct))].slice(0, 3);
  const options = [correct, ...set];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer: options.indexOf(correct) };
}

const THINGS = [
  ['苹果', '斤'],
  ['香蕉', '斤'],
  ['西瓜', '斤'],
  ['葡萄', '斤'],
  ['矿泉水', '瓶'],
  ['咖啡', '杯'],
  ['本子', '个'],
] as const;

/** un ejercicio de números al oído: la respuesta casi nunca es el número que se dice tal cual */
export function numberDrill(rand: Rand = Math.random, only?: NumberDrill['kind']): NumberDrill {
  const kind = only ?? pick(rand, ['hora', 'hora', 'precio', 'descuento', 'vuelto', 'cantidad', 'cifra'] as const);

  if (kind === 'hora') {
    const h = int(rand, 1, 12);
    const form = int(rand, 0, 4);
    if (form === 0) {
      const m = pick(rand, [5, 10, 20]);
      return {
        kind,
        audio: `现在差${toChinese(m)}分${counted(h)}点。`,
        question: '¿Qué hora es?',
        ...choices(rand, hhmm(h - 1, 60 - m), [hhmm(h, m), hhmm(h, 60 - m), hhmm(h - 1, m)]),
        why: `差${toChinese(m)}分${counted(h)}点 = faltan ${m} minutos para las ${h}.`,
      };
    }
    if (form === 1) {
      return {
        kind,
        audio: `现在${counted(h)}点差一刻。`,
        question: '¿Qué hora es?',
        ...choices(rand, hhmm(h - 1, 45), [hhmm(h, 15), hhmm(h, 45), hhmm(h - 1, 15)]),
        why: `${counted(h)}点差一刻 = las ${h} menos cuarto.`,
      };
    }
    if (form === 2) {
      const k = pick(rand, [1, 3]);
      return {
        kind,
        audio: `我们${counted(h)}点${k === 1 ? '一' : '三'}刻见面。`,
        question: '¿A qué hora se ven?',
        ...choices(rand, hhmm(h, k * 15), [hhmm(h, k === 1 ? 45 : 15), hhmm(h, 30), hhmm(h, k === 1 ? 10 : 3)]),
        why: `一刻 = 15 minutos; 三刻 = 45 minutos.`,
      };
    }
    if (form === 3) {
      return {
        kind,
        audio: `电影${counted(h)}点半开始。`,
        question: '¿A qué hora empieza la película?',
        ...choices(rand, hhmm(h, 30), [hhmm(h, 0), hhmm(h, 15), hhmm(h + 1, 30)]),
        why: `半 = y media.`,
      };
    }
    const m = pick(rand, [5, 10, 20, 25, 40, 50]);
    return {
      kind,
      audio: `火车${counted(h)}点${m < 10 ? '零' : ''}${toChinese(m)}分开。`,
      question: '¿A qué hora sale el tren?',
      ...choices(rand, hhmm(h, m), [
        hhmm(h, m === 40 ? 14 : m === 50 ? 15 : m + 30 > 59 ? m - 20 : m + 30),
        hhmm(h + 1, m),
        hhmm(h - 1, m),
      ]),
      why: `${counted(h)}点${toChinese(m)}分 = ${hhmm(h, m)}.`,
    };
  }

  if (kind === 'precio') {
    const [thing, mw] = pick(rand, THINGS);
    const p = int(rand, 3, 12);
    const n = int(rand, 2, 5);
    return {
      kind,
      audio: `${thing}${toChinese(p)}块钱一${mw}，我要${counted(n)}${mw}。`,
      question: '¿Cuánto paga en total?',
      ...choices(rand, `${p * n} yuanes`, [`${p} yuanes`, `${p + n} yuanes`, `${p * n + p} yuanes`, `${p * (n - 1)} yuanes`]),
      why: `${p} × ${n} = ${p * n}.`,
    };
  }

  if (kind === 'descuento') {
    const price = pick(rand, [100, 200, 300, 400, 500, 800, 1000]);
    const z = pick(rand, [5, 6, 7, 8, 9]);
    const pay = (price * z) / 10;
    return {
      kind,
      audio: `这件衣服原价${toChinese(price)}块，现在打${toChinese(z)}折。`,
      question: '¿Cuánto cuesta ahora?',
      ...choices(rand, `${pay} yuanes`, [
        `${price - pay} yuanes`,
        `${price - z * 10} yuanes`,
        `${price} yuanes`,
        `${pay + 50} yuanes`,
      ]),
      why: `打${toChinese(z)}折 = pagas el ${z * 10} % (no es ${z * 10} % de descuento).`,
    };
  }

  if (kind === 'vuelto') {
    const total = int(rand, 12, 88);
    const given = total <= 50 ? pick(rand, [50, 100]) : 100;
    return {
      kind,
      audio: `一共${toChinese(total)}块。我给你${toChinese(given)}块。`,
      question: '¿Cuánto le devuelven?',
      ...choices(rand, `${given - total} yuanes`, [
        `${total} yuanes`,
        `${given - total + 10} yuanes`,
        `${Math.abs(given - total - 10)} yuanes`,
        `${given} yuanes`,
      ]),
      why: `${given} − ${total} = ${given - total}.`,
    };
  }

  if (kind === 'cantidad') {
    const base = pick(rand, [20, 30, 40, 60, 80, 120, 200]);
    const double = rand() < 0.5;
    const result = double ? base * 2 : base / 2;
    return {
      kind,
      audio: double
        ? `去年我们班有${toChinese(base)}个学生，今年的学生是去年的两倍。`
        : `这本书有${toChinese(base)}页，我已经看了一半。`,
      question: double ? '¿Cuántos estudiantes hay este año?' : '¿Cuántas páginas ha leído?',
      ...choices(rand, String(result), [String(base), String(double ? base / 2 : base * 2), String(result + 10)]),
      why: double ? `两倍 = el doble: ${base} × 2.` : `一半 = la mitad: ${base} ÷ 2.`,
    };
  }

  const n = pick(rand, [105, 150, 208, 320, 1200, 2050, 3500, 12000, 20000, 25000, 30500]);
  const wrong = [n * 10, Math.round(n / 10), n >= 10000 ? n / 10 + 500 : n + 100, n + 1000].map((x) => x.toLocaleString('es'));
  return {
    kind,
    audio: `${toChinese(n)}。`,
    question: '¿Qué número oíste?',
    ...choices(rand, n.toLocaleString('es'), wrong),
    why: `${toChinese(n)}: 万 = 10.000, 千 = 1.000, 百 = 100.`,
  };
}
