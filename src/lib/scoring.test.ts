import { describe, expect, it } from 'vitest';

import {
  DELIVERY_SCHEME,
  formatSchemeForPrompt,
  getScoringScheme,
  totalFromBreakdown,
  type ScoringScheme,
} from './scoring';

import { SPEECH_TEMPLATES } from './speech-config';

/**
 * The marking schemes are the app's answer to "how is this scored?", so the
 * invariant they rest on has to hold: every scheme totals exactly 100.
 *
 * This is not a formality. totalFromBreakdown() rejects a model's breakdown
 * whose maximums do not sum to the scheme's own total, so a scheme that
 * drifted off 100 would silently stop correcting scores rather than fail
 * loudly — the app would keep working and quietly publish uncorrected marks.
 */

const ALL_SCHEMES: [string, ScoringScheme][] = [
  ['general (no template)', getScoringScheme(null)],
  ...SPEECH_TEMPLATES.map((t) => [t.label, getScoringScheme(t.id)] as [string, ScoringScheme]),
  ['delivery', DELIVERY_SCHEME],
];

describe('scoring schemes', () => {
  it.each(ALL_SCHEMES)('%s totals exactly 100', (_label, scheme) => {
    const total = scheme.criteria.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBe(100);
  });

  it.each(ALL_SCHEMES)('%s has no zero or negative weights', (_label, scheme) => {
    for (const criterion of scheme.criteria) {
      expect(criterion.weight).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SCHEMES)('%s has uniquely named criteria', (_label, scheme) => {
    // Duplicate names would make a breakdown ambiguous to read back.
    const names = scheme.criteria.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('falls back to the general scheme for an unknown template id', () => {
    // A stale template id from an old client must not throw.
    const scheme = getScoringScheme('not-a-real-template' as never);
    expect(scheme.criteria.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
});

describe('formatSchemeForPrompt', () => {
  const scheme = getScoringScheme(null);
  const prompt = formatSchemeForPrompt(scheme);

  it('names every criterion with its weight', () => {
    for (const criterion of scheme.criteria) {
      expect(prompt).toContain(criterion.name);
      expect(prompt).toContain(String(criterion.weight));
    }
  });

  it('states the exact criterion count', () => {
    // Dropping criteria was a real failure: a run marked 5 of 8 and reported
    // 52/100. Stating the count is what fixed it, so it has to stay stated.
    expect(prompt).toContain(String(scheme.criteria.length));
  });
});

describe('totalFromBreakdown', () => {
  const scheme = getScoringScheme(null);
  const validRows = () => scheme.criteria.map((c) => ({
    label: c.name,
    value: `${c.weight}/${c.weight}`,
  }));

  it('sums a full-marks breakdown to 100', () => {
    expect(totalFromBreakdown(validRows(), scheme)).toBe(100);
  });

  it('recomputes the total, ignoring what the model claimed', () => {
    // The whole point: models drifted 4-5 points from their own breakdowns.
    const rows = validRows();
    rows[0] = { label: rows[0].label, value: `0/${scheme.criteria[0].weight}` };
    const expected = 100 - scheme.criteria[0].weight;
    expect(totalFromBreakdown(rows, scheme)).toBe(expected);
  });

  it('ignores a Total row the model added itself', () => {
    const rows = [...validRows(), { label: 'Total', value: '87/100' }];
    expect(totalFromBreakdown(rows, scheme)).toBe(100);
  });

  it('returns null when a criterion is missing', () => {
    expect(totalFromBreakdown(validRows().slice(1), scheme)).toBeNull();
  });

  it('returns null when the model invents its own maximums', () => {
    const rows = validRows().map((r) => ({ label: r.label, value: '10/10' }));
    expect(totalFromBreakdown(rows, scheme)).toBeNull();
  });

  it('returns null on an unparseable row', () => {
    const rows = validRows();
    rows[2] = { label: rows[2].label, value: 'good effort' };
    expect(totalFromBreakdown(rows, scheme)).toBeNull();
  });

  it('returns null on an empty breakdown', () => {
    expect(totalFromBreakdown([], scheme)).toBeNull();
  });

  it('clamps into 0-100 rather than returning a nonsense score', () => {
    const rows = validRows().map((r, i) => ({
      label: r.label,
      // Award far more than available on the first row.
      value: i === 0 ? `999/${scheme.criteria[0].weight}` : r.value,
    }));
    const total = totalFromBreakdown(rows, scheme);
    expect(total).not.toBeNull();
    expect(total!).toBeLessThanOrEqual(100);
    expect(total!).toBeGreaterThanOrEqual(0);
  });
});
