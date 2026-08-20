import { describe, expect, it } from 'vitest';

import {
  getRehearsalSegmentIndex,
  rehearsalEstimatedSeconds,
  segmentRehearsalScript,
} from '@/lib/rehearsal';

describe('guided rehearsal script helpers', () => {
  it('separates delivery cues from words the speaker should say', () => {
    const segments = segmentRehearsalScript('[warmly] Welcome everyone. [pause] This matters now.');

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ spokenText: 'Welcome everyone.', cues: ['warmly'] });
    expect(segments[1]).toMatchObject({ spokenText: 'This matters now.', cues: ['pause'] });
  });

  it('keeps punctuation and creates a fallback for an unpunctuated script', () => {
    expect(segmentRehearsalScript('One question? One answer!')).toHaveLength(2);
    expect(segmentRehearsalScript('[firmly] A short final line')).toEqual([
      expect.objectContaining({ spokenText: 'A short final line', cues: ['firmly'] }),
    ]);
  });

  it('does not split common abbreviations or decimal numbers into fake lines', () => {
    const segments = segmentRehearsalScript('Dr. King cited 3.5 million people. The room listened.');
    expect(segments.map((segment) => segment.spokenText)).toEqual([
      'Dr. King cited 3.5 million people.',
      'The room listened.',
    ]);
  });

  it('carries a cue-only paragraph into the next spoken line', () => {
    const segments = segmentRehearsalScript('First point.\n\n[long pause]\n\nNow the conclusion.');
    expect(segments).toHaveLength(2);
    expect(segments[1]).toMatchObject({ spokenText: 'Now the conclusion.', cues: ['long pause'] });
  });

  it('advances highlights by speaking speed and stops at the final line', () => {
    const segments = segmentRehearsalScript('One two three four five. Six seven eight nine ten.');
    expect(getRehearsalSegmentIndex(segments, 0, 'steady')).toBe(0);
    expect(getRehearsalSegmentIndex(segments, 4, 'steady')).toBe(1);
    expect(getRehearsalSegmentIndex(segments, 999, 'steady')).toBe(1);
    expect(getRehearsalSegmentIndex(segments, 0, 'steady', 1)).toBe(1);
  });

  it('adds time for deliberate pauses', () => {
    const plain = segmentRehearsalScript('This is one line.');
    const paused = segmentRehearsalScript('[long pause] This is one line.');
    expect(rehearsalEstimatedSeconds(paused, 'steady')).toBeGreaterThan(rehearsalEstimatedSeconds(plain, 'steady'));
  });
});
