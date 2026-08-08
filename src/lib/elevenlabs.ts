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

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

/**
 * Voice picks are deliberate, and deliberately NOT the stock voices people
 * instantly recognize as AI (Adam, Rachel, and the George voice ElevenLabs
 * uses in its own quickstart). These two read as performers rather than
 * narrators, which is what a speech needs.
 *
 * v3's own guidance is that the voice matters more than any tag: it has to
 * already be capable of the delivery you're asking for. A soft narration voice
 * flattens the bolder lines no matter what tags you send.
 *
 * `stability` sits at v3's "Creative" end (below the 0.5 "Natural" midpoint).
 * That is what makes the audio tags actually land — "Robust" stability is
 * steadier but stops responding to directional prompts.
 */
export const EXAMPLE_VOICES: Record<ExampleVoice, { voiceId: string; label: string; settings: VoiceSettings }> = {
  female: {
    // "Lily — Velvety Actress": British, confident. An actor's voice, so it
    // carries the theatrical lines instead of evening them out.
    voiceId: 'pFZP5JQG7iQjIQuC4Bku',
    label: 'Lily',
    settings: {
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.45,
      use_speaker_boost: true,
      speed: 0.97,
    },
  },
  male: {
    // "Eric — Smooth, Trustworthy": American, classy. Magnetic and measured
    // rather than the blunt announcer tone of the stock male voices.
    voiceId: 'cjVigY5qzO86Huf0OWal',
    label: 'Eric',
    settings: {
      stability: 0.35,
      similarity_boost: 0.8,
      style: 0.42,
      use_speaker_boost: true,
      speed: 0.96,
    },
  },
};

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
