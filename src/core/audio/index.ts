/**
 * TTS con Web Speech API.
 *
 * Detalles de los navegadores que se cuidan aquí:
 * - iOS solo deja hablar después de un gesto del usuario. Con el primer toque o tecla se
 *   "desbloquea" la voz con un enunciado vacío; desde ahí la app puede hablar sola
 *   (por ejemplo, las tarjetas de escuchar al aparecer).
 * - Safari y Chrome a veces ignoran un `speak()` que llega justo después de `cancel()`:
 *   si había algo sonando, se espera un instante antes de hablar.
 * - Chrome carga las voces de forma asíncrona: se esperan (hasta 1 s) antes de elegir una.
 * - Chrome puede no avisar el final si el enunciado se recolecta: se guarda una referencia.
 * - Si el navegador bloquea el audio, `onBlocked` avisa para mostrar "toca para escuchar".
 */

let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  const v = speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

export const ttsSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

let voicesReady: Promise<void> | null = null;
/** espera a que el navegador cargue sus voces (Chrome las da tarde) */
export function whenVoicesReady(timeoutMs = 1000): Promise<void> {
  if (!ttsSupported() || loadVoices().length) return Promise.resolve();
  voicesReady ??= new Promise<void>((resolve) => {
    const done = () => {
      loadVoices();
      resolve();
    };
    speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
  return voicesReady;
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

let unlocked = false;
/** con el primer toque o tecla, desbloquea la voz en iOS (un enunciado vacío y mudo) */
export function unlockSpeechOnFirstGesture() {
  if (typeof window === 'undefined' || !ttsSupported() || unlocked) return;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {
      /* sin voz: nada que desbloquear */
    }
    for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) window.removeEventListener(ev, unlock, true);
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(ev, unlock, { capture: true });
}

const QUALITY = /(premium|enhanced|mejorada|neural|natural|google)/i;

export function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  const target = norm(locale);
  const lang = target.split('-')[0];
  const exact = voices.filter((v) => norm(v.lang) === target);
  const sameLang = voices.filter((v) => norm(v.lang).startsWith(`${lang}-`) || norm(v.lang) === lang);
  // para chino mandarín no sirve una voz cantonesa (zh-HK)
  const pool = (exact.length ? exact : sameLang).filter(
    (v) => !(lang === 'zh' && /hk|yue|cantonese/i.test(`${v.lang} ${v.name}`)),
  );
  return pool.find((v) => QUALITY.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0];
}

export function hasVoiceFor(locale: string): boolean {
  return Boolean(pickVoice(locale));
}

export interface SpeakOptions {
  rate?: number;
  /** termina, falla o el navegador no la deja sonar */
  onEnd?: () => void;
  /** empezó a sonar */
  onStart?: () => void;
  /** no arrancó en 2,5 s: casi siempre, el navegador exige un toque (iOS) */
  onBlocked?: () => void;
}

/** enunciados vivos: evita que Chrome los recolecte antes de terminar (y no avise el final) */
const live = new Set<SpeechSynthesisUtterance>();
let generation = 0;

function play(utterances: SpeechSynthesisUtterance[], opts: SpeakOptions) {
  const my = ++generation;
  let started = false;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    utterances.forEach((u) => live.delete(u));
    opts.onEnd?.();
  };
  const first = utterances[0];
  const last = utterances[utterances.length - 1];
  first.onstart = () => {
    started = true;
    opts.onStart?.();
  };
  last.onend = finish;
  utterances.forEach((u) => {
    u.onerror = (e) => {
      // "interrupted"/"canceled": otra frase la reemplazó; no es un error del usuario
      if (e.error === 'not-allowed' && !started) opts.onBlocked?.();
      finish();
    };
  });

  const go = () => {
    if (my !== generation) return; // llegó otra petición mientras tanto
    utterances.forEach((u) => {
      live.add(u);
      speechSynthesis.speak(u);
    });
    setTimeout(() => {
      // algunos navegadores no emiten onstart: si está sonando, también vale
      if (my === generation && !started && !finished && !speechSynthesis.speaking) {
        opts.onBlocked?.();
        speechSynthesis.cancel();
        finish();
      }
    }, 2500);
  };

  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy) speechSynthesis.cancel();
  void whenVoicesReady().then(() => {
    const voice = pickVoice(utterances[0].lang);
    try {
      if (voice) utterances.forEach((u) => (u.voice = voice));
    } catch {
      /* voz no asignable: el navegador elige una por el idioma */
    }
    if (busy) setTimeout(go, 80);
    else go();
  });
}

export function speak(text: string, locale: string, { rate = 0.9, ...opts }: SpeakOptions = {}): void {
  if (!ttsSupported() || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  u.rate = rate;
  play([u], opts);
}

export interface SpeechPart {
  text: string;
  /** 1 = normal; más bajo suena más grave */
  pitch?: number;
}

/** lee varias partes seguidas (p. ej. los turnos de un diálogo, alternando el tono de voz) */
export function speakSequence(parts: SpeechPart[], locale: string, { rate = 0.9, ...opts }: SpeakOptions = {}): void {
  if (!ttsSupported() || parts.length === 0) {
    opts.onEnd?.();
    return;
  }
  const us = parts.map((part) => {
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = locale;
    u.rate = rate;
    u.pitch = part.pitch ?? 1;
    return u;
  });
  play(us, opts);
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  generation++;
  speechSynthesis.cancel();
}

// ---------- sonidos de feedback (sintetizados, sin archivos) ----------

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain = 0.08, type: OscillatorType = 'sine') {
  const c = audioCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playCorrect() {
  tone(660, 0, 0.12);
  tone(990, 0.08, 0.18);
}

export function playWrong() {
  tone(220, 0, 0.22, 0.07, 'triangle');
}

export function playComplete() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.07));
}
