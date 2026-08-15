import { describe, expect, it } from 'vitest';

import {
  DELIVERY_CUES,
  buildPerformanceScript,
  formatCueListForPrompt,
  getAvailableAccents,
  getVoiceId,
  translateDeliveryCues,
} from './elevenlabs';

/**
 * The cue pipeline has a specific, user-visible failure mode: v3 speaks
 * unrecognised bracket text aloud. A cue the writer is allowed to use but the
 * translator does not know becomes the voice literally saying "emphasise".
 *
 * So the invariant is that the prompt's cue list and the translator are built
 * from one table and cannot drift apart.
 */

describe('cue vocabulary', () => {
  it('offers the writer exactly the cues the translator handles', () => {
    const advertised = formatCueListForPrompt()
      .split('\n')
      .map((line) => line.match(/^\[([^\]]+)\]/)?.[1])
      .filter(Boolean) as string[];

    expect(new Set(advertised)).toEqual(new Set(DELIVERY_CUES.map((c) => c.cue)));
  });

  it('resolves every advertised cue to its own v3 form', () => {
    // Some cues translate to a tag spelled the same ([softly], [gently]), so
    // the property is that the output equals the mapping, not that the cue
    // text disappeared.
    for (const { cue, v3 } of DELIVERY_CUES) {
      const out = translateDeliveryCues(`Before [${cue}] after.`);
      expect(out).toContain(v3.trim());
    }
  });

  it('leaves no bracket text v3 would read aloud', () => {
    // The real failure mode: a cue surviving as text the voice speaks.
    const known = new Set(
      DELIVERY_CUES.map(({ v3 }) => v3.trim().toLowerCase()).filter((v) => v.startsWith('[')),
    );
    for (const { cue } of DELIVERY_CUES) {
      const out = translateDeliveryCues(`Before [${cue}] after.`);
      for (const [, tag] of out.matchAll(/(\[[^\]\n]+\])/g)) {
        expect(known).toContain(tag.toLowerCase());
      }
    }
  });

  it('has no duplicate cue names', () => {
    const names = DELIVERY_CUES.map((c) => c.cue);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('translateDeliveryCues', () => {
  it('converts a cue to its v3 tag', () => {
    expect(translateDeliveryCues('Stay [firmly] here')).toContain('[firmly]');
  });

  it('turns [pause] into the ellipsis v3 uses for timing', () => {
    // v3 has no SSML break tag, so a pause must become punctuation.
    const out = translateDeliveryCues('One [pause] two');
    expect(out).not.toContain('[pause]');
    expect(out).toContain('...');
  });

  it('matches "long pause" before "pause" swallows it', () => {
    const out = translateDeliveryCues('One [long pause] two');
    expect(out).not.toContain('pause');
  });

  it('strips an invented cue rather than letting the voice read it', () => {
    const out = translateDeliveryCues('A [dramatic flourish] B');
    expect(out).not.toContain('dramatic');
    expect(out).toContain('A');
    expect(out).toContain('B');
  });

  it('is case-insensitive', () => {
    expect(translateDeliveryCues('x [FIRMLY] y')).toContain('[firmly]');
  });

  it('leaves ordinary bracketed prose out of the audio', () => {
    // Anything unrecognised is removed; nothing unknown may survive.
    const out = translateDeliveryCues('The report [see appendix] said so.');
    expect(out).not.toContain('appendix');
  });
});

describe('emotional cues', () => {
  /* Added after a generated speech about suicide was delivered cheerfully:
     there was no way to mark grief, so the voice defaulted to bright. */

  it.each([
    ['sombrely', '[sad]'],
    ['gravely', '[solemnly]'],
    ['gently', '[gently]'],
    ['hopefully', '[hopeful]'],
    ['joyfully', '[happy]'],
    ['angrily', '[angry]'],
    ['reflectively', '[thoughtful]'],
  ])('maps [%s] to the documented v3 tag %s', (cue, tag) => {
    expect(translateDeliveryCues(`x [${cue}] y`)).toContain(tag);
  });

  it.each([
    '[sadly]', '[sorrowful]', '[mournfully]', '[somber]', '[grieving]',
  ])('rescues %s, the spelling a model reaches for first', (variant) => {
    const out = translateDeliveryCues(`x ${variant} y`);
    expect(out).toContain('[sad]');
  });

  it.each(['[solemn]', '[reverently]', '[tenderly]', '[compassionately]', '[wistfully]'])(
    'rescues the near-miss %s instead of discarding it',
    (variant) => {
      const out = translateDeliveryCues(`x ${variant} y`);
      expect(out).toMatch(/\[(sad|solemnly|gently|thoughtful)\]/);
    },
  );
});

describe('buildPerformanceScript', () => {
  it('primes a grave script with the solemn header', () => {
    const script = buildPerformanceScript('[sombrely] Seven hundred thousand people died.');
    expect(script.split('\n')[0]).toContain('[solemn]');
    expect(script.split('\n')[0]).not.toContain('commanding');
  });

  it('primes an ordinary script with the confident header', () => {
    const script = buildPerformanceScript('[warmly] Welcome, everyone, to the fair.');
    expect(script.split('\n')[0]).toContain('[confident]');
  });

  it('does not turn solemn on a hopeful speech that merely sounds upbeat', () => {
    const script = buildPerformanceScript('[joyfully] We won the cup this year.');
    expect(script.split('\n')[0]).toContain('[confident]');
  });

  it('emits no unknown bracket text at all', () => {
    const script = buildPerformanceScript('A [pause] B [invented tag] C [gravely] D');
    const tags = [...script.matchAll(/\[([^\]\n]+)\]/g)].map((m) => m[1]);
    for (const tag of tags) {
      expect(tag).not.toContain('invented');
    }
  });

  it('keeps the speaker\'s words intact', () => {
    const script = buildPerformanceScript('[gravely] The number is seven hundred thousand.');
    expect(script).toContain('The number is seven hundred thousand.');
  });
});

describe('voice matrix', () => {
  it('reports availability consistently with getVoiceId', () => {
    const available = getAvailableAccents();
    for (const [accent, flags] of Object.entries(available)) {
      expect(Boolean(getVoiceId(accent as never, 'male'))).toBe(flags.male);
      expect(Boolean(getVoiceId(accent as never, 'female'))).toBe(flags.female);
      expect(flags.any).toBe(flags.male || flags.female);
    }
  });

  it('returns null for an unknown accent rather than throwing', () => {
    expect(getVoiceId('klingon' as never, 'male')).toBeNull();
  });
});
