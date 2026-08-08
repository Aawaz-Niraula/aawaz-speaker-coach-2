/**
 * Delivery metrics derived from Whisper's word-level timestamps.
 *
 * `verbose_json` already returns per-word timing on every transcription, so all
 * of this is free: no extra API call, no added latency, no vendor. These are
 * measurements rather than inferences, which is why the coach is told to treat
 * them as authoritative for pace and pausing.
 */

export type WhisperWord = {
  word?: unknown;
  start?: unknown;
  end?: unknown;
};

export type WhisperSegment = {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  no_speech_prob?: unknown;
  words?: unknown;
};

export type SpeechMetrics = {
  /** Pauses of at least PAUSE_MIN seconds, longest first. */
  pauses: { at: number; seconds: number }[];
  longestPause: number;
  /** Pauses per minute — a proxy for whether the speaker breathes at all. */
  pauseRate: number;
  /** Words per minute for each ~15s window, so pace variation is visible. */
  paceCurve: { at: number; wpm: number }[];
  /** Standard deviation of the pace curve. Near zero means metronomic. */
  paceVariation: number;
  /** Filler words that follow a pause — hesitation rather than verbal tic. */
  hesitations: number;
  fillerCount: number;
  /** Longest stretch with no pause at all, in seconds. */
  longestRun: number;
  /** Pauses long enough to read as dead air rather than rhetorical timing. */
  deadAirCount: number;
  /** Fraction of the recording that is silence. */
  silenceRatio: number;
  wordsPerMin: number;
  durationSeconds: number;
};

/** A gap this long or longer counts as a deliberate pause, not word spacing. */
const PAUSE_MIN = 0.45;
/** Gaps longer than this are usually dead air rather than rhetorical timing. */
const LONG_PAUSE = 2.5;

const FILLERS = new Set([
  'um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm',
  'like', 'basically', 'actually', 'literally', 'so', 'yeah', 'okay',
]);

function normalizeWord(value: unknown) {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-z']/g, '')
    : '';
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pulls a flat word list out of either the top-level `words` or the segments. */
export function collectWords(data: { words?: unknown; segments?: unknown }): { word: string; start: number; end: number }[] {
  const raw: WhisperWord[] = Array.isArray(data.words)
    ? (data.words as WhisperWord[])
    : Array.isArray(data.segments)
      ? (data.segments as WhisperSegment[]).flatMap((s) => (Array.isArray(s.words) ? (s.words as WhisperWord[]) : []))
      : [];

  const words: { word: string; start: number; end: number }[] = [];
  for (const item of raw) {
    const start = toNumber(item?.start);
    const end = toNumber(item?.end);
    const word = typeof item?.word === 'string' ? item.word.trim() : '';
    if (word && start !== null && end !== null && end >= start) {
      words.push({ word, start, end });
    }
  }

  return words.sort((a, b) => a.start - b.start);
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeSpeechMetrics(
  data: { words?: unknown; segments?: unknown; duration?: unknown },
  fallbackDuration = 0,
): SpeechMetrics | null {
  const words = collectWords(data);
  // Below this there is not enough timing data for the numbers to mean anything.
  if (words.length < 12) return null;

  const duration = toNumber(data.duration) ?? fallbackDuration ?? 0;
  const spoken = duration > 0 ? duration : words[words.length - 1].end;
  if (spoken <= 0) return null;

  /* ── Pauses ──────────────────────────────────────────────────────── */
  const pauses: { at: number; seconds: number }[] = [];
  let silence = 0;
  let longestRun = 0;
  let runStart = words[0].start;

  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_MIN) {
      pauses.push({ at: Number(words[i - 1].end.toFixed(2)), seconds: Number(gap.toFixed(2)) });
      silence += gap;
      longestRun = Math.max(longestRun, words[i - 1].end - runStart);
      runStart = words[i].start;
    }
  }
  longestRun = Math.max(longestRun, words[words.length - 1].end - runStart);

  const sortedPauses = [...pauses].sort((a, b) => b.seconds - a.seconds);

  /* ── Pace curve ──────────────────────────────────────────────────── */
  const WINDOW = 15;
  const paceCurve: { at: number; wpm: number }[] = [];
  for (let t = 0; t < spoken; t += WINDOW) {
    const inWindow = words.filter((w) => w.start >= t && w.start < t + WINDOW).length;
    const span = Math.min(WINDOW, spoken - t);
    if (span >= 4 && inWindow > 0) {
      paceCurve.push({ at: Math.round(t), wpm: Math.round((inWindow / span) * 60) });
    }
  }

  /* ── Fillers and hesitation ──────────────────────────────────────── */
  let fillerCount = 0;
  let hesitations = 0;
  for (let i = 0; i < words.length; i += 1) {
    if (!FILLERS.has(normalizeWord(words[i].word))) continue;
    fillerCount += 1;
    // A filler preceded by a gap reads as searching for the word, which is a
    // different (and more fixable) problem than filler used as punctuation.
    if (i > 0 && words[i].start - words[i - 1].end >= 0.25) hesitations += 1;
  }

  return {
    pauses: sortedPauses.slice(0, 5),
    longestPause: sortedPauses[0]?.seconds ?? 0,
    pauseRate: Number(((pauses.length / spoken) * 60).toFixed(1)),
    deadAirCount: pauses.filter((p) => p.seconds >= LONG_PAUSE).length,
    paceCurve,
    paceVariation: Math.round(standardDeviation(paceCurve.map((p) => p.wpm))),
    hesitations,
    fillerCount,
    longestRun: Number(longestRun.toFixed(1)),
    silenceRatio: Number((silence / spoken).toFixed(2)),
    wordsPerMin: Math.round((words.length / spoken) * 60),
    durationSeconds: Number(spoken.toFixed(1)),
  };
}

/** Renders the metrics as prompt text for the coach. */
export function formatMetricsForPrompt(m: SpeechMetrics) {
  // Pace variation needs several windows to mean anything. On a short clip the
  // standard deviation is 0 simply because there is one data point, which must
  // not be reported as monotone delivery.
  const hasPaceCurve = m.paceCurve.length > 1;

  const paceLine = hasPaceCurve
    ? m.paceCurve.map((p) => `${p.at}s:${p.wpm}`).join(', ')
    : 'recording too short to chart pace variation';

  const variationLine = hasPaceCurve
    ? `- Pace variation (std dev): ${m.paceVariation} wpm ${m.paceVariation < 12 ? '(very flat — near-metronomic delivery)' : m.paceVariation > 45 ? '(erratic — pace lurches)' : '(healthy variation)'}`
    : '- Pace variation: not measurable on a recording this short. Do not comment on pace variation or monotony.';

  const pauseLine = m.pauses.length
    ? m.pauses.map((p) => `${p.seconds}s at ${p.at}s`).join(', ')
    : 'no pauses of 0.45s or longer';

  return `MEASURED DELIVERY DATA (from word-level timestamps — these are measurements, not estimates, and are authoritative for pace and pausing):
- Duration: ${m.durationSeconds}s, ${m.wordsPerMin} words/min overall
- Pace across the speech (words/min per 15s): ${paceLine}
${variationLine}
- Longest pauses: ${pauseLine}
- Pause rate: ${m.pauseRate} per minute ${m.pauseRate < 2 ? '(rarely pauses — likely rushing without breath)' : ''}
- Pauses long enough to read as dead air (2.5s+): ${m.deadAirCount}${m.deadAirCount > 2 ? ' (the speech keeps stalling)' : ''}
- Longest unbroken run without a pause: ${m.longestRun}s ${m.longestRun > 30 ? '(very long — the audience gets no processing space)' : ''}
- Silence: ${Math.round(m.silenceRatio * 100)}% of the recording
- Filler words: ${m.fillerCount} total, of which ${m.hesitations} follow a gap (searching for the word, not verbal habit)

Use these numbers directly in the analysis. Do not contradict them or invent different figures.`;
}
