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

/**
 * The header used when the script itself is grave.
 *
 * The default header primes every performance as warm and commanding, which is
 * right for most speeches and badly wrong for a few. A speech about suicide,
 * grief or violence delivered "warm, deliberate, commanding" sounds cheerful
 * about its subject — the complaint that prompted this. The register has to
 * follow the material, so a script carrying somber emotional cues is primed
 * somberly instead.
 */
const SOMBER_HEADER =
  '[solemn] [speaking to a live audience] [subdued, measured, sincere]';

/** Emotional cues whose presence means the script is a grave one. */
const SOMBER_TAGS = ['[sad]', '[solemnly]', '[gently]', '[sighs]'];

/**
 * Picks the opening register from the cues the writer actually used.
 *
 * Deliberately keyed off the translated tags rather than the topic string: the
 * writer has already read the topic and chosen a register, and a keyword list
 * would both miss euphemisms and misfire on a hopeful speech that merely
 * mentions a hard word.
 */
function selectDeliveryHeader(translated: string) {
  const lower = translated.toLowerCase();
  return SOMBER_TAGS.some((tag) => lower.includes(tag)) ? SOMBER_HEADER : DELIVERY_HEADER;
}

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
/**
 * Delivery cues written by the speech generator, mapped to what v3 actually
 * acts on.
 *
 * Generated speeches carry inline cues like [pause] and [emphasise] so the
 * script reads as something to perform. Passing them through untranslated is
 * worse than useless: v3 speaks unrecognised bracket text aloud. Each cue is
 * either converted to a real v3 audio tag, or to the punctuation v3 uses for
 * timing — it has no SSML break tag, so ellipses and line breaks are the only
 * way to buy a beat.
 */
/**
 * The complete set of delivery cues a generated speech may use.
 *
 * This is the single source of truth: the speech writer is given exactly this
 * list and told nothing outside it is permitted, and the translator below is
 * built from the same table. Keeping one list means the two cannot drift apart
 * and start disagreeing about what is legal.
 *
 * `v3` is what the cue becomes on its way to ElevenLabs — either a real v3
 * audio tag, or the punctuation v3 uses for timing, since it has no SSML break
 * tag. `hint` is the one-line explanation shown to the writer.
 */
export const DELIVERY_CUES: { cue: string; v3: string; hint: string }[] = [
  { cue: 'pause', v3: '...', hint: 'a beat, after a point that needs to land' },
  { cue: 'long pause', v3: '\n\n...\n\n', hint: 'before a turn in the argument, or after your strongest line' },
  { cue: 'breathe', v3: '\n\n[exhales]\n', hint: 'a real breath, usually before a new section' },
  { cue: 'slower', v3: '[slowly]', hint: 'deliberately slow down' },
  { cue: 'faster', v3: '[quickly]', hint: 'deliberately pick up the pace' },
  { cue: 'softly', v3: '[softly]', hint: 'drop the voice for something intimate or serious' },
  { cue: 'louder', v3: '[loudly]', hint: 'lift for a call to action or a peak' },
  { cue: 'higher pitch', v3: '[brightly]', hint: 'lift the register' },
  { cue: 'lower pitch', v3: '[seriously]', hint: 'drop the register' },
  { cue: 'emphasise', v3: '[emphatically]', hint: 'immediately before the word that must carry weight' },
  { cue: 'warmly', v3: '[warmly]', hint: 'the intent behind a friendly line' },
  { cue: 'firmly', v3: '[firmly]', hint: 'the intent behind an assertive line' },
  { cue: 'with conviction', v3: '[confidently]', hint: 'the intent behind your strongest claim' },

  // Emotional register. Without these the voice defaults to bright and
  // energetic, which is badly wrong on a speech about loss, grief or suicide:
  // the words say one thing and the delivery says another.
  { cue: 'sombrely', v3: '[sad]', hint: 'grief, loss, or a death toll — the weight of the subject' },
  { cue: 'gravely', v3: '[solemnly]', hint: 'the seriousness of a hard truth, without self-pity' },
  { cue: 'gently', v3: '[gently]', hint: 'a fragile subject, or speaking to someone who is hurting' },
  { cue: 'hopefully', v3: '[hopeful]', hint: 'the turn toward what can change' },
  { cue: 'joyfully', v3: '[happy]', hint: 'genuine celebration or good news' },
  { cue: 'angrily', v3: '[angry]', hint: 'controlled anger at an injustice, used sparingly' },
  { cue: 'reflectively', v3: '[thoughtful]', hint: 'thinking aloud, or recalling something' },
  { cue: 'sighs', v3: '[sighs]', hint: 'the weight of something, before you carry on' },
];

/** Renders the allowed cues for the speech-writing prompt. */
export function formatCueListForPrompt() {
  return DELIVERY_CUES.map(({ cue, hint }) => `[${cue}] — ${hint}`).join('\n');
}

/** Escapes a cue name for use inside a regular expression. */
function cuePattern(cue: string) {
  return new RegExp(`\\[\\s*${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\]`, 'gi');
}

/**
 * Near-misses of the legal cues, mapped to the cue they clearly meant.
 *
 * Models reliably drift a little — [pauses] for [pause], [loudly] for [louder],
 * a stray "for effect". Discarding those loses a beat the writer intended, so
 * the obvious variants are accepted rather than thrown away. Anything genuinely
 * invented still gets stripped.
 */
const CUE_ALIASES: [RegExp, string][] = [
  [/\[\s*(?:pauses|pause briefly|short pause|beat)\s*\]/gi, '[pause]'],
  [/\[\s*pause[sd]?\s+[^\]\n]{0,24}\]/gi, '[pause]'],
  [/\[\s*(?:longer pause|long beat)\s*\]/gi, '[long pause]'],
  [/\[\s*(?:breath|breathes|breathing|deep breath|inhales?)\s*\]/gi, '[breathe]'],
  [/\[\s*(?:loudly|loud|raise voice|raising voice)\s*\]/gi, '[louder]'],
  [/\[\s*(?:quietly|soft|lower voice|hushed)\s*\]/gi, '[softly]'],
  [/\[\s*(?:slowly|slow down|slow)\s*\]/gi, '[slower]'],
  [/\[\s*(?:quickly|quicker|speed up)\s*\]/gi, '[faster]'],
  [/\[\s*(?:emphasi[sz]ed?|emphasi[sz]ing|emphatic|stress)\s*\]/gi, '[emphasise]'],
  [/\[\s*(?:confidently|confident|conviction)\s*\]/gi, '[with conviction]'],
  [/\[\s*(?:warm|warmer)\s*\]/gi, '[warmly]'],
  [/\[\s*(?:firm|firmer|sternly)\s*\]/gi, '[firmly]'],
  [/\[\s*(?:higher|rising pitch|brighter)\s*\]/gi, '[higher pitch]'],
  [/\[\s*(?:lower|falling pitch|deeper)\s*\]/gi, '[lower pitch]'],
  // Emotional near-misses. [sadly] is the spelling a model reaches for first,
  // so it must not be the one that gets discarded.
  [/\[\s*(?:sadly|sad|sorrowful|sorrowfully|mournful|mournfully|somber|sombre|somberly|grief|grieving)\s*\]/gi, '[sombrely]'],
  [/\[\s*(?:solemn|solemnly|gravely|grave|reverent|reverently)\s*\]/gi, '[gravely]'],
  [/\[\s*(?:gentle|tenderly|tender|compassionate|compassionately|kindly)\s*\]/gi, '[gently]'],
  [/\[\s*(?:hopeful|hopefully|optimistic|optimistically|uplifting)\s*\]/gi, '[hopefully]'],
  [/\[\s*(?:happy|happily|joyful|joyfully|cheerful|cheerfully|delighted)\s*\]/gi, '[joyfully]'],
  [/\[\s*(?:angry|angrily|furious|furiously|indignant|indignantly|outraged)\s*\]/gi, '[angrily]'],
  [/\[\s*(?:thoughtful|thoughtfully|reflective|reflectively|pensive|pensively|wistful|wistfully)\s*\]/gi, '[reflectively]'],
  [/\[\s*(?:sighs?|sighing|heavy sigh)\s*\]/gi, '[sighs]'],
];

// Longest first, so "long pause" is matched before "pause" would swallow it.
const CUE_MAP: [RegExp, string][] = [...DELIVERY_CUES]
  .sort((a, b) => b.cue.length - a.cue.length)
  .map(({ cue, v3 }) => [cuePattern(cue), v3]);

/**
 * v3 tags allowed to survive translation.
 *
 * Everything the cue table produces, plus the handful of tags the tour
 * narration writes by hand. Anything else in brackets would be spoken aloud.
 */
const KNOWN_TAGS = new Set(
  [
    ...DELIVERY_CUES.map(({ v3 }) => v3.trim()).filter((v) => v.startsWith('[')),
    '[exhales]', '[sighs]', '[laughs]', '[giggles]', '[whispers]',
    '[excited]', '[curious]', '[thoughtfully]', '[gently]',
    '[cheerfully]', '[playfully]', '[knowingly]',
    // Emotional tags, all documented for v3.
    '[sad]', '[solemnly]', '[hopeful]', '[happy]', '[angry]', '[thoughtful]',
  ].map((tag) => tag.toLowerCase()),
);

/** Converts our delivery cues into v3 tags, and drops anything v3 would read out. */
export function translateDeliveryCues(text: string) {
  let out = text;

  // Normalise near-misses onto a legal cue first, so a drifted [pauses] still
  // buys its beat instead of being discarded.
  for (const [pattern, canonical] of CUE_ALIASES) {
    out = out.replace(pattern, canonical);
  }

  for (const [pattern, replacement] of CUE_MAP) {
    out = out.replace(pattern, replacement);
  }

  // Belt and braces: the writer is restricted to the cue list, but a model can
  // still invent one. Anything not recognised is removed rather than left for
  // the voice to read out as "[dramatic flourish]".
  out = out.replace(/\[[^\]\n]{1,40}\]/g, (match) => (KNOWN_TAGS.has(match.trim().toLowerCase()) ? match : ''));

  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildPerformanceScript(text: string) {
  const cued = translateDeliveryCues(text);

  const paragraphs = cued
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  const body = (paragraphs.length ? paragraphs : [cued.replace(/\s+/g, ' ').trim()])
    // A line break after each sentence gives v3 a natural place to breathe;
    // blank lines between paragraphs mark the bigger rhetorical pauses.
    .map((paragraph) => paragraph.replace(BEAT_ENDINGS, '$1\n'))
    .join('\n\n');

  return `${selectDeliveryHeader(cued)}\n\n${body}`;
}
