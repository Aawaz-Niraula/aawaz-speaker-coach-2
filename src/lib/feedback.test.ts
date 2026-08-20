import { describe, expect, it } from 'vitest';

import { extractScore, isCompleteFeedbackReport, parseFeedback, sanitizeModelReport, scoreGrade } from './feedback';

/**
 * parseFeedback turns the model's report into everything the results card
 * shows. It fails silently by design — an unmatched section yields an empty
 * string rather than an error — so a broken pattern would ship a blank report
 * while the app looked healthy.
 *
 * That nearly happened: the heading was renamed from "BRUTALLY HONEST
 * FEEDBACK" to "HONEST FEEDBACK" and the pattern still matched only the old
 * spelling. These fixtures pin both report shapes and both heading spellings.
 */

const STANDARD_REPORT = `📊 ANALYSIS
• Filler words: 2
• Speaking speed: 158 words/min
• Overall score: 84/100

📐 MARK BREAKDOWN
• Structure & shape: 17/20
• Logos — reasoning & evidence: 16/20
• Ethos — credibility: 12/15
• Pathos — emotional resonance: 11/13
• Language & clarity: 8/10
• Pace & rhythm: 7/8
• Pausing: 6/7
• Fluency & filler: 7/7
• Total: 84/100

🔥 HONEST FEEDBACK
The opening earns attention with a specific scene rather than a thesis.
Your evidence is real and cited, which most speeches skip.

🛠️ 3 SPECIFIC FIXES
1. Cut the second example, it repeats the first.
2. Slow the final line by half.
3. Replace "very important" with the actual stake.`;

const DEEP_REPORT = `🎧 DELIVERY ANALYSIS
• Speaking speed: 141 words/min
• Pauses: You left deliberate gaps after each key point.
• Delivery score: 78/100

📐 MARK BREAKDOWN
• Speed: 16/20
• Pauses: 15/20
• Conviction: 14/18
• Fluency: 12/15
• Tone: 11/15
• Emphasis: 10/12
• Total: 78/100

🎯 WHAT YOUR VOICE DID WELL
You drop your pitch on the closing line, which lands it.

⚠️ WHAT HELD IT BACK
The middle third flattens out into a single register.

🎤 3 DELIVERY DRILLS
1. Read paragraph three at half speed.
2. Mark three words to hit and only those.
3. Record the close alone, five times.`;

describe('extractScore', () => {
  it('reads the overall score from a standard report', () => {
    expect(extractScore(STANDARD_REPORT)).toBe(84);
  });

  it('reads the delivery score from a deep report', () => {
    expect(extractScore(DEEP_REPORT)).toBe(78);
  });

  it('returns null when no score is present', () => {
    expect(extractScore('no score anywhere here')).toBeNull();
  });
});

describe('parseFeedback on the standard report', () => {
  const parsed = parseFeedback(STANDARD_REPORT);

  it('extracts the score', () => {
    expect(parsed.score).toBe(84);
  });

  it('lists the analysis items but not the score row', () => {
    expect(parsed.analysisItems).toEqual([
      { label: 'Filler words', value: '2' },
      { label: 'Speaking speed', value: '158 words/min' },
    ]);
  });

  it('extracts every criterion from the breakdown', () => {
    expect(parsed.markBreakdown).toHaveLength(8);
    expect(parsed.markBreakdown[0]).toEqual({ label: 'Structure & shape', value: '17/20' });
    // A criterion name containing a colon must split on the last one.
    expect(parsed.markBreakdown[1]).toEqual({ label: 'Logos — reasoning & evidence', value: '16/20' });
  });

  it('excludes the Total row from the breakdown rows', () => {
    expect(parsed.markBreakdown.map((r) => r.label)).not.toContain('Total');
  });

  it('captures the prose feedback without bleeding into the fixes', () => {
    expect(parsed.brutalFeedback).toContain('opening earns attention');
    expect(parsed.brutalFeedback).not.toContain('Cut the second example');
  });

  it('captures exactly three fixes with numbering stripped', () => {
    expect(parsed.fixes).toHaveLength(3);
    expect(parsed.fixes[0]).toBe('Cut the second example, it repeats the first.');
  });
});

describe('parseFeedback on the deep report', () => {
  const parsed = parseFeedback(DEEP_REPORT);

  it('extracts the delivery score', () => {
    expect(parsed.score).toBe(78);
  });

  it('reads the differently-headed analysis section', () => {
    expect(parsed.analysisItems).toEqual([
      { label: 'Speaking speed', value: '141 words/min' },
      { label: 'Pauses', value: 'You left deliberate gaps after each key point.' },
    ]);
  });

  it('joins the split strengths and weaknesses sections', () => {
    // The deep report has no "HONEST FEEDBACK" heading at all; both halves
    // must still reach the card.
    expect(parsed.brutalFeedback).toContain('drop your pitch');
    expect(parsed.brutalFeedback).toContain('flattens out');
  });

  it('reads drills under their own heading', () => {
    expect(parsed.fixes).toHaveLength(3);
    expect(parsed.fixes[0]).toBe('Read paragraph three at half speed.');
  });
});

describe('parseFeedback heading tolerance', () => {
  it('still parses the legacy BRUTALLY HONEST FEEDBACK heading', () => {
    // Saved reports from before the rename must not render blank.
    const legacy = STANDARD_REPORT.replace('🔥 HONEST FEEDBACK', '🔥 BRUTALLY HONEST FEEDBACK');
    expect(parseFeedback(legacy).brutalFeedback).toContain('opening earns attention');
  });

  it('parses a report stripped of its emoji', () => {
    const plain = STANDARD_REPORT.replace(/[📊📐🔥🛠️]/gu, '').replace(/^\s+/gm, '');
    const parsed = parseFeedback(plain);
    expect(parsed.score).toBe(84);
    expect(parsed.markBreakdown).toHaveLength(8);
    expect(parsed.brutalFeedback).toContain('opening earns attention');
  });

  it('never throws on malformed input', () => {
    for (const input of ['', 'garbage', '📊 ANALYSIS\n', '📐 MARK BREAKDOWN\n\n\n']) {
      expect(() => parseFeedback(input)).not.toThrow();
    }
  });

  it('returns empty structures rather than nulls for an empty report', () => {
    const parsed = parseFeedback('');
    expect(parsed.analysisItems).toEqual([]);
    expect(parsed.markBreakdown).toEqual([]);
    expect(parsed.fixes).toEqual([]);
    expect(parsed.brutalFeedback).toBe('');
  });

  it('discards closed reasoning before a valid report', () => {
    const parsed = parseFeedback(`<think>Private scoring notes that must never render.</think>\n\n${STANDARD_REPORT}`);
    expect(parsed.score).toBe(84);
    expect(parsed.rawText).toBe(STANDARD_REPORT);
    expect(parsed.rawText).not.toContain('Private scoring notes');
  });

  it('recovers a valid report after an unterminated reasoning block', () => {
    const parsed = parseFeedback(`<think>Private notes without a closing tag.\n\n${STANDARD_REPORT}`);
    expect(parsed.score).toBe(84);
    expect(parsed.analysisItems).toHaveLength(2);
    expect(parsed.rawText.startsWith('📊 ANALYSIS')).toBe(true);
  });

  it('turns reasoning-only output into an empty safe value', () => {
    expect(sanitizeModelReport('<think>Internal chain of thought only.')).toBe('');
  });
});

describe('isCompleteFeedbackReport', () => {
  it('accepts both complete standard and deep reports', () => {
    expect(isCompleteFeedbackReport(STANDARD_REPORT)).toBe(true);
    expect(isCompleteFeedbackReport(DEEP_REPORT)).toBe(true);
  });

  it('rejects prose and incomplete reports before they reach the UI', () => {
    expect(isCompleteFeedbackReport('<think>Reasoning only.')).toBe(false);
    expect(isCompleteFeedbackReport('📊 ANALYSIS\n• Speaking speed: 140 words/min')).toBe(false);
  });
});

describe('scoreGrade', () => {
  it('covers the whole 0-100 range without a gap', () => {
    for (let score = 0; score <= 100; score++) {
      expect(scoreGrade(score).label).toBeTruthy();
    }
  });
});
