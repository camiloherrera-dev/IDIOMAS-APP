/**
 * TTS con Web Speech API. En iOS la voz solo arranca tras un gesto del usuario,
 * por eso `speak` se llama siempre desde un handler de toque.
 */

let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  const v = speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export const ttsSupported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

const QUALITY = /(premium|enhanced|mejorada|neural|natural|google)/i;

export function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  const target = norm(locale);
  const lang = target.split('-')[0];
  const exact = voices.filter((v) => norm(v.lang) === target);
  const sameLang = voices.filter((v) => norm(v.lang).startsWith(`${lang}-`) || norm(v.lang) === lang);
  const pool = exact.length ? exact : sameLang;
  return pool.find((v) => QUALITY.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0];
}

export function hasVoiceFor(locale: string): boolean {
  return Boolean(pickVoice(locale));
}

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
}

export function speak(text: string, locale: string, { rate = 0.9, onEnd }: SpeakOptions = {}): void {
  if (!ttsSupported()) {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;
  u.rate = rate;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) speechSynthesis.cancel();
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
