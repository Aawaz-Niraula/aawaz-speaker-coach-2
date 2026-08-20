import type { SpeechTemplateId } from '@/lib/speech-config';

export type RehearsalSpeed = 'slow' | 'steady' | 'brisk';

export type RehearsalScript = {
  speechId: string;
  topic: string;
  script: string;
  templateId: SpeechTemplateId;
  templateLabel: string;
};

export type RehearsalSegment = {
  id: string;
  spokenText: string;
  cues: string[];
  wordCount: number;
};

export const REHEARSAL_WPM: Record<RehearsalSpeed, number> = {
  slow: 110,
  steady: 140,
  brisk: 165,
};

const CUE_PATTERN = /\[([^\]]+)]/g;
const ABBREVIATION_END = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e)\.$/i;

function splitRehearsalParagraph(paragraph: string) {
  const chunks: string[] = [];
  let start = 0;

  for (let index = 0; index < paragraph.length; index += 1) {
    const character = paragraph[index];
    if (character !== '.' && character !== '!' && character !== '?') continue;

    if (character === '.') {
      const previous = paragraph[index - 1] ?? '';
      const next = paragraph[index + 1] ?? '';
      if (/\d/.test(previous) && /\d/.test(next)) continue;
      if (next === '.') continue;
      if (ABBREVIATION_END.test(paragraph.slice(0, index + 1))) continue;
      if (/^[A-Za-z]\.[A-Za-z]\.$/.test(paragraph.slice(Math.max(0, index - 1), index + 3))) continue;
    }

    let end = index + 1;
    while (/["”’']/.test(paragraph[end] ?? '')) end += 1;
    const sentence = paragraph.slice(start, end).trim();
    if (sentence) chunks.push(sentence);
    start = end;
    index = end - 1;
  }

  const remainder = paragraph.slice(start).trim();
  if (remainder) chunks.push(remainder);
  return chunks;
}

function cueDelaySeconds(cues: string[]) {
  return cues.reduce((total, cue) => {
    const normalized = cue.toLowerCase();
    if (normalized === 'long pause') return total + 1.8;
    if (normalized === 'pause') return total + 0.8;
    if (normalized === 'breathe') return total + 1.1;
    return total;
  }, 0);
}

/**
 * Turns a generated speech into calm, sentence-sized teleprompter cards.
 * Performance cues are kept as visual directions but removed from the words
 * the speaker is expected to say.
 */
export function segmentRehearsalScript(script: string): RehearsalSegment[] {
  const segments: RehearsalSegment[] = [];
  let pendingCues: string[] = [];

  for (const paragraph of script.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const chunks = splitRehearsalParagraph(paragraph.trim());

    for (const rawChunk of chunks) {
      const cues = [...rawChunk.matchAll(CUE_PATTERN)].map((match) => match[1].trim()).filter(Boolean);
      const spokenText = rawChunk.replace(CUE_PATTERN, ' ').replace(/\s+/g, ' ').trim();

      if (!spokenText) {
        pendingCues.push(...cues);
        continue;
      }

      const wordCount = spokenText.split(/\s+/).filter(Boolean).length;
      segments.push({
        id: `line-${segments.length + 1}`,
        spokenText,
        cues: [...pendingCues, ...cues],
        wordCount,
      });
      pendingCues = [];
    }
  }

  if (!segments.length && script.trim()) {
    const spokenText = script.replace(CUE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    if (spokenText) {
      segments.push({
        id: 'line-1',
        spokenText,
        cues: [...script.matchAll(CUE_PATTERN)].map((match) => match[1].trim()).filter(Boolean),
        wordCount: spokenText.split(/\s+/).filter(Boolean).length,
      });
    }
  }

  return segments;
}

export function segmentDurationSeconds(segment: RehearsalSegment, speed: RehearsalSpeed) {
  const spokenSeconds = (segment.wordCount / REHEARSAL_WPM[speed]) * 60;
  return Math.max(1.8, spokenSeconds + cueDelaySeconds(segment.cues));
}

/** Returns the highlighted line after `elapsedSeconds`, starting at a line chosen by the user. */
export function getRehearsalSegmentIndex(
  segments: RehearsalSegment[],
  elapsedSeconds: number,
  speed: RehearsalSpeed,
  startIndex = 0,
) {
  if (!segments.length) return 0;
  const safeStart = Math.max(0, Math.min(segments.length - 1, startIndex));
  let remaining = Math.max(0, elapsedSeconds);

  for (let index = safeStart; index < segments.length; index += 1) {
    const duration = segmentDurationSeconds(segments[index], speed);
    if (remaining < duration) return index;
    remaining -= duration;
  }

  return segments.length - 1;
}

export function rehearsalEstimatedSeconds(segments: RehearsalSegment[], speed: RehearsalSpeed) {
  return Math.round(segments.reduce((total, segment) => total + segmentDurationSeconds(segment, speed), 0));
}
