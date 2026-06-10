'use client';

/**
 * Tiny Web Audio synth for UI sound effects — no audio assets needed.
 * All sounds are short, quiet, and respect the user's Aawax sound setting
 * and the OS reduced-motion preference.
 */

let audioContext: AudioContext | null = null;
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;

  type Ctor = typeof AudioContext;
  const Ctor: Ctor | undefined = window.AudioContext || (window as Window & { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => null);
  }

  return audioContext;
}

type ToneOptions = {
  freq: number;
  /** Glide target frequency, if any. */
  freqEnd?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  /** Delay from now, in seconds. */
  at?: number;
};

function tone({ freq, freqEnd, duration = 0.12, type = 'sine', gain = 0.05, at = 0 }: ToneOptions) {
  if (!soundEnabled) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), start + duration);
    }

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch {
    // never let a sound effect break the UI
  }
}

export const sfx = {
  /** Soft navigation tick. */
  tick() {
    tone({ freq: 1250, duration: 0.045, type: 'sine', gain: 0.022 });
  },

  /** Mascot boop — cute pitch-bend squeak. */
  tap() {
    tone({ freq: 540, freqEnd: 920, duration: 0.14, type: 'triangle', gain: 0.06 });
    tone({ freq: 1080, freqEnd: 1450, duration: 0.1, type: 'sine', gain: 0.025, at: 0.04 });
  },

  /** Small bubble pop for toggles and reveals. */
  pop() {
    tone({ freq: 880, freqEnd: 520, duration: 0.085, type: 'sine', gain: 0.05 });
  },

  /** Option selected in a picker. */
  select() {
    tone({ freq: 660, duration: 0.07, type: 'triangle', gain: 0.04 });
    tone({ freq: 990, duration: 0.09, type: 'triangle', gain: 0.04, at: 0.06 });
  },

  /** Gacha shuffle — playful roll up. */
  shuffle() {
    [440, 554, 659, 880].forEach((freq, i) => {
      tone({ freq, duration: 0.07, type: 'square', gain: 0.022, at: i * 0.055 });
    });
    tone({ freq: 1318, duration: 0.18, type: 'sine', gain: 0.045, at: 0.24 });
  },

  /** Generic success chime. */
  success() {
    tone({ freq: 523.25, duration: 0.12, type: 'sine', gain: 0.045 });
    tone({ freq: 783.99, duration: 0.16, type: 'sine', gain: 0.045, at: 0.09 });
  },

  /** Big celebration for high scores. */
  fanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone({ freq, duration: 0.16, type: 'triangle', gain: 0.045, at: i * 0.09 });
    });
    tone({ freq: 1568, duration: 0.3, type: 'sine', gain: 0.03, at: 0.42 });
  },

  /** Recording starts — rising cue. */
  recordStart() {
    tone({ freq: 392, freqEnd: 660, duration: 0.16, type: 'sine', gain: 0.05 });
  },

  /** Recording stops — falling cue. */
  recordStop() {
    tone({ freq: 660, freqEnd: 392, duration: 0.16, type: 'sine', gain: 0.05 });
  },

  /** Something went wrong — gentle, not alarming. */
  oops() {
    tone({ freq: 330, freqEnd: 247, duration: 0.18, type: 'triangle', gain: 0.04 });
  },
};
