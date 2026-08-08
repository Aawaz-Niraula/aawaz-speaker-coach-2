/**
 * ElevenLabs text-to-speech configuration for the Speech Practice feature.
 *
 * Eleven v3 is the most expressive model — it is the only one that understands
 * inline audio tags (`[confident]`, `[pauses]`, …), which is how we direct a
 * flat AI script into something that sounds like a person on a stage rather
 * than a narrator reading a page.
 *
 * Docs: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
 */

export const ELEVENLABS_MODEL_ID = 'eleven_v3';

/** MP3 at 44.1kHz/128kbps — the ElevenLabs default and widely playable. */
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';

export type ExampleVoice = 'female' | 'male';
export type ExampleAccent = 'american' | 'british' | 'australian' | 'indian';

/** Accent options in the order they appear in the UI toggle. */
export const EXAMPLE_ACCENTS: ExampleAccent[] = ['american', 'british', 'australian', 'indian'];

export const DEFAULT_ACCENT: ExampleAccent = 'american';

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

/**
 * Shared delivery settings.
 *
 * `stability` sits at v3's "Creative" end (below the 0.5 "Natural" midpoint).
 * That is what lets the voice respond to direction at all — "Robust" is
 * steadier but stops reacting to the performance cues in the script.
 */
const SPEAKER_SETTINGS: VoiceSettings = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.45,
  use_speaker_boost: true,
  speed: 0.97,
};

/**
 * Accent × gender voice matrix.
 *
 * ElevenLabs has no accent parameter — accent is a property of the voice
 * itself, so every accent/gender pair needs its own voice id. These are
 * account-owned voices rather than shared library ones, so they cannot be
 * delisted underneath us and carry no per-use credit multiplier.
 *
 * `null` means "not recorded yet". The UI disables those options instead of
 * quietly falling back to another accent, which would hand the user audio in
 * an accent they did not pick.
 */
export const EXAMPLE_VOICES: Record<ExampleAccent, Record<ExampleVoice, string | null>> = {
  american: {
    male: 'azl4cj8puwHzFuGD57JW',
    female: 'SVVsD086X2FoKHNXIAvI',
  },
  british: {
    male: 'iDh7bt9IgHCI2d76JKsp',
    female: 'vzsPZ1iLeI0pbhyfJYXE',
  },
  australian: {
    male: 'jroWqdTlNyDAuhcwemHO',
    female: 'tW5Oeop9djFjbQFRjCGg',
  },
  indian: {
    male: 'pitY9e4i5hQRcz3XOBs6',
    female: '6BewuYjAq0BrR4J876uS',
  },
};

/** Resolves a voice id, or null when that accent/gender pair has no voice yet. */
export function getVoiceId(accent: ExampleAccent, voice: ExampleVoice): string | null {
  return EXAMPLE_VOICES[accent]?.[voice] ?? null;
}

export function getVoiceSettings(): VoiceSettings {
  return SPEAKER_SETTINGS;
}

/** Accent/gender pairs that currently have a voice, for the UI to enable. */
export function getAvailableAccents(): Record<ExampleAccent, { male: boolean; female: boolean; any: boolean }> {
  return EXAMPLE_ACCENTS.reduce((acc, accent) => {
    const male = Boolean(EXAMPLE_VOICES[accent].male);
    const female = Boolean(EXAMPLE_VOICES[accent].female);
    acc[accent] = { male, female, any: male || female };
    return acc;
  }, {} as Record<ExampleAccent, { male: boolean; female: boolean; any: boolean }>);
}

/**
 * v3 has no `style_instruction` field — delivery is directed by audio tags and
 * punctuation inside the text itself. This header is the equivalent of the
 * style prompt we used to send: it primes the performance, and the tags below
 * are what the model actually acts on.
 */
const DELIVERY_HEADER =
  '[confident] [speaking to a live audience] [warm, deliberate, commanding]';

/** Sentence-ending punctuation that already carries a natural beat. */
const BEAT_ENDINGS = /([.!?])\s+/g;

/**
 * Turns a plain generated script into a v3 performance script.
 *
 * Two things make v3 sound human rather than read-aloud:
 *  1. a delivery tag at the top that sets the whole performance, and
 *  2. paragraph-level breathing room, since v3 uses line breaks and ellipses
 *     for pacing (it does not support SSML `<break>` tags at all).
 *
 * We deliberately do NOT rewrite the user's words or sprinkle emotion tags
 * mid-sentence — mis-placed tags get spoken or cause artifacts, and the script
 * shown on screen has to match the audio the user hears.
 */
export function buildPerformanceScript(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const body = (paragraphs.length ? paragraphs : [text.replace(/\s+/g, ' ').trim()])
    // A line break after each sentence gives v3 a natural place to breathe;
    // blank lines between paragraphs mark the bigger rhetorical pauses.
    .map((paragraph) => paragraph.replace(BEAT_ENDINGS, '$1\n'))
    .join('\n\n');

  return `${DELIVERY_HEADER}\n\n${body}`;
}
