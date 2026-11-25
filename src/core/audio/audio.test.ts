import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** imitación mínima de la Web Speech API */
class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: { name: string; lang: string } | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth(opts: { voices: { name: string; lang: string; localService?: boolean }[]; blocked?: boolean }) {
  const listeners: Record<string, (() => void)[]> = {};
  const synth = {
    speaking: false,
    pending: false,
    spoken: [] as FakeUtterance[],
    cancels: 0,
    voices: opts.voices,
    getVoices: () => synth.voices,
    addEventListener: (ev: string, fn: () => void) => (listeners[ev] ??= []).push(fn),
    emit: (ev: string) => listeners[ev]?.forEach((fn) => fn()),
    cancel: () => {
      synth.cancels++;
      synth.speaking = false;
    },
    speak: (u: FakeUtterance) => {
      synth.spoken.push(u);
      if (opts.blocked) return; // iOS sin gesto: no pasa nada
      synth.speaking = true;
      setTimeout(() => u.onstart?.(), 10);
      setTimeout(() => {
        synth.speaking = false;
        u.onend?.();
      }, 50);
    },
  };
  return synth;
}

async function load(synth: ReturnType<typeof fakeSynth>) {
  vi.resetModules();
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return import('./index');
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('voz', () => {
  it('elige una voz de mandarín y descarta la cantonesa', async () => {
    const synth = fakeSynth({
      voices: [
        { name: 'Sin-ji', lang: 'zh-HK' },
        { name: 'Tingting', lang: 'zh-CN', localService: true },
        { name: 'Samantha', lang: 'en-US' },
      ],
    });
    const audio = await load(synth);
    expect(audio.pickVoice('zh-CN')?.name).toBe('Tingting');
    expect(audio.hasVoiceFor('pt-BR')).toBe(false);
  });

  it('habla, avisa que empezó y que terminó', async () => {
    const synth = fakeSynth({ voices: [{ name: 'Tingting', lang: 'zh-CN' }] });
    const audio = await load(synth);
    const onStart = vi.fn();
    const onEnd = vi.fn();
    audio.speak('你好', 'zh-CN', { onStart, onEnd });
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.spoken.map((u) => u.text)).toEqual(['你好']);
    expect(synth.spoken[0].voice?.name).toBe('Tingting');
    expect(onStart).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('si había algo sonando, cancela y espera un instante antes de hablar', async () => {
    const synth = fakeSynth({ voices: [{ name: 'Tingting', lang: 'zh-CN' }] });
    const audio = await load(synth);
    audio.speak('一', 'zh-CN');
    await vi.advanceTimersByTimeAsync(20);
    expect(synth.speaking).toBe(true);
    audio.speak('二', 'zh-CN');
    expect(synth.cancels).toBe(1);
    await vi.advanceTimersByTimeAsync(40);
    expect(synth.spoken.map((u) => u.text)).toEqual(['一']); // todavía no
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.spoken.map((u) => u.text)).toEqual(['一', '二']);
  });

  it('espera a que carguen las voces (Chrome)', async () => {
    const synth = fakeSynth({ voices: [] });
    const audio = await load(synth);
    audio.speak('你好', 'zh-CN');
    await vi.advanceTimersByTimeAsync(5);
    expect(synth.spoken).toHaveLength(0);
    synth.voices = [{ name: 'Google 普通话（中国大陆）', lang: 'zh-CN' }];
    synth.emit('voiceschanged');
    await vi.advanceTimersByTimeAsync(5);
    expect(synth.spoken[0].voice?.name).toContain('Google');
  });

  it('avisa cuando el navegador no deja sonar (iOS sin gesto)', async () => {
    const synth = fakeSynth({ voices: [{ name: 'Tingting', lang: 'zh-CN' }], blocked: true });
    const audio = await load(synth);
    const onBlocked = vi.fn();
    const onEnd = vi.fn();
    audio.speak('你好', 'zh-CN', { onBlocked, onEnd });
    await vi.advanceTimersByTimeAsync(3000);
    expect(onBlocked).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('el primer toque desbloquea la voz una sola vez', async () => {
    const synth = fakeSynth({ voices: [{ name: 'Tingting', lang: 'zh-CN' }] });
    const audio = await load(synth);
    audio.unlockSpeechOnFirstGesture();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0].volume).toBe(0);
  });
});
