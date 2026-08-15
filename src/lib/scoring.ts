/**
 * Concrete marking schemes.
 *
 * The score used to be a single number an LLM produced from written criteria,
 * which meant there was no answer to "how is this marked?" beyond "the model
 * decided". Each rubric now carries an explicit weighted breakdown that adds
 * to 100, so a score can be explained, argued with, and reproduced.
 *
 * Weights differ per format because the formats value different things: a
 * debate lives or dies on argument and rebuttal, a chief-guest speech on
 * protocol and dignity, Monroe's on hitting five steps in order.
 *
 * The model still assigns the marks — it is judging speech, not counting
 * widgets — but it now marks each criterion out of a stated maximum and shows
 * its working, rather than producing one unexplained number.
 */

import type { SpeechTemplateId } from '@/lib/speech-config';

export type ScoringCriterion = {
  /** Shown to the user and to the model. */
  name: string;
  /** Marks available for this criterion. All criteria in a scheme total 100. */
  weight: number;
  /** What full marks look like, and what loses them. */
  descriptor: string;
};

export type ScoringScheme = {
  label: string;
  criteria: ScoringCriterion[];
};

/* ── Delivery criteria shared by every content scheme ──────────────────
   These are the same everywhere because they are measured from the audio
   rather than judged: the numbers come from Whisper's word timings, so the
   marks behind them mean the same thing whatever the format. */
const DELIVERY_PACE: ScoringCriterion = {
  name: 'Pace & rhythm',
  weight: 8,
  descriptor:
    'Full marks for a speaking rate in the 120-165 wpm range that varies with the material. Deduct for sustained rushing, for a near-metronomic delivery (pace variation under 12 wpm), and for lurching between speeds.',
};

const DELIVERY_PAUSES: ScoringCriterion = {
  name: 'Pausing',
  weight: 7,
  descriptor:
    'Full marks for deliberate pauses that give the audience room to absorb key points. Deduct for a pause rate under 2 per minute, for unbroken runs over 30 seconds, and for dead air over 2.5 seconds that reads as stalling rather than timing.',
};

const DELIVERY_FLUENCY: ScoringCriterion = {
  name: 'Fluency & filler',
  weight: 7,
  descriptor:
    'Full marks for clean phrasing with negligible filler. Deduct in proportion to the measured filler count, weighting fillers that follow a gap more heavily since those signal searching for words rather than a verbal habit.',
};

const SHARED_DELIVERY = [DELIVERY_PACE, DELIVERY_PAUSES, DELIVERY_FLUENCY];

/* ── General public speaking (no template) ─────────────────────────────
   Judged on ELP, so the three appeals carry the largest share. */
const GENERAL_SCHEME: ScoringScheme = {
  label: 'General public speaking (ELP)',
  criteria: [
    {
      name: 'Structure & shape',
      weight: 20,
      descriptor:
        'Full marks for a clear opening that establishes purpose fast, a body organised around distinct points with real transitions, and an ending that lands. Deduct for wandering openings, points that blur together, and conclusions that fade out.',
    },
    {
      name: 'Logos — reasoning & evidence',
      weight: 20,
      descriptor:
        'Full marks for claims supported by facts, figures, examples or sound cause-and-effect. Deduct heavily for assertions with no support, circular reasoning, or vague generalities standing in for argument.',
    },
    {
      name: 'Ethos — credibility',
      weight: 15,
      descriptor:
        'Full marks where the speaker earns trust: first-hand experience, relevant knowledge, or authority demonstrated rather than claimed. Deduct for hedging that undercuts their own standing.',
    },
    {
      name: 'Pathos — emotional resonance',
      weight: 13,
      descriptor:
        'Full marks for imagery, story or stakes that make the audience feel the issue rather than merely understand it. Deduct for flat recitation of information, and equally for manufactured intensity with nothing behind it.',
    },
    {
      name: 'Language & clarity',
      weight: 10,
      descriptor:
        'Full marks for precise, concrete wording suited to an audience hearing it once. Deduct for vagueness, repetition, and phrasing that has to be re-read to be understood.',
    },
    ...SHARED_DELIVERY,
  ],
};

/* ── Formal: organiser ─────────────────────────────────────────────────
   An operational role: protocol and control of the room outrank rhetoric. */
const ORGANISER_SCHEME: ScoringScheme = {
  label: 'Formal event speech — organiser',
  criteria: [
    {
      name: 'Protocol & acknowledgement order',
      weight: 25,
      descriptor:
        'Full marks for greeting guests in the correct order of precedence and observing the formalities of the occasion. Deduct for missed dignitaries, wrong order, and casual address where formality is required.',
    },
    {
      name: 'Purpose & occasion framing',
      weight: 18,
      descriptor:
        'Full marks for establishing why everyone is gathered within the opening moments. Deduct for burying the purpose or leaving it implied.',
    },
    {
      name: 'Sequencing & control',
      weight: 17,
      descriptor:
        'Full marks for deliberate, operationally clear movement between segments, and a close that hands over with authority. Deduct for improvised-sounding transitions and an ending that trails off.',
    },
    {
      name: 'Formal register',
      weight: 15,
      descriptor:
        'Full marks for composed, dignified language sustained throughout. Deduct for slang, filler-heavy phrasing, rambling thanks, or informality that lowers the tone of the event.',
    },
    {
      name: 'Concision',
      weight: 3,
      descriptor:
        'Full marks for saying what the occasion requires without padding. Deduct for repeated thanks and circling back over the same acknowledgements.',
    },
    ...SHARED_DELIVERY,
  ],
};

/* ── Formal: chief guest ───────────────────────────────────────────────
   Ceremonial: dignity and the honouring of the occasion carry the weight. */
const CHIEF_GUEST_SCHEME: ScoringScheme = {
  label: 'Formal ceremonial speech — chief guest',
  criteria: [
    {
      name: 'Ceremonial protocol',
      weight: 22,
      descriptor:
        'Full marks for an opening that establishes respect and occasion immediately, with the formalities correctly observed. Deduct for casual openings and broken protocol.',
    },
    {
      name: 'Dignity of register',
      weight: 20,
      descriptor:
        'Full marks for polished, elevated language worthy of the occasion, warm without becoming chatty. Deduct for informality, clumsy praise, and wording that diminishes the event.',
    },
    {
      name: 'Recognition & significance',
      weight: 18,
      descriptor:
        'Full marks for acknowledging the occasion and the people properly, and making its significance felt. Deduct for perfunctory or generic recognition.',
    },
    {
      name: 'Message & sequencing',
      weight: 15,
      descriptor:
        'Full marks for a clear line through occasion, recognition, significance and key message. Deduct for a message that never arrives or arrives out of order.',
    },
    {
      name: 'Closing',
      weight: 3,
      descriptor:
        'Full marks for an ending that feels intentional and ceremonious. Deduct for a flat or abrupt finish.',
    },
    ...SHARED_DELIVERY,
  ],
};

/* ── Debate ────────────────────────────────────────────────────────────
   Competitive argument: clash and evidence dominate. */
const DEBATE_SCHEME: ScoringScheme = {
  label: 'Debate speech',
  criteria: [
    {
      name: 'Clarity of stance',
      weight: 15,
      descriptor:
        'Full marks for a claim stated early and unambiguously, and held consistently. Deduct for a delayed, hedged, or drifting position.',
    },
    {
      name: 'Argument quality & support',
      weight: 25,
      descriptor:
        'Full marks for separate, well-ranked arguments each carried by evidence or sound reasoning. Deduct for unsupported assertion, repetition dressed as a second point, and emotional appeal substituting for logic.',
    },
    {
      name: 'Rebuttal & clash',
      weight: 20,
      descriptor:
        'Full marks for anticipating the opposing case, refuting it directly, and weighing the two comparatively. Deduct heavily where the other side is ignored entirely.',
    },
    {
      name: 'Structure & signposting',
      weight: 12,
      descriptor:
        'Full marks where the listener always knows which argument is being made. Deduct for points that run together without signposting.',
    },
    {
      name: 'Assertive control',
      weight: 6,
      descriptor:
        'Full marks for a confident, strategically paced delivery that sounds in command of the material. Deduct for drama without substance and for tentative phrasing that undercuts the case.',
    },
    ...SHARED_DELIVERY,
  ],
};

/* ── Monroe's Motivated Sequence ───────────────────────────────────────
   Five fixed steps: each is marked, and order counts. */
const MONROE_SCHEME: ScoringScheme = {
  label: "Monroe's Motivated Sequence",
  criteria: [
    {
      name: 'Attention',
      weight: 14,
      descriptor:
        'Full marks for an opening that seizes attention with a hook, striking fact, story or question. Deduct for slow, generic, or self-referential openings.',
    },
    {
      name: 'Need',
      weight: 16,
      descriptor:
        'Full marks for a real, urgent problem established with evidence and made to feel personally relevant. Deduct for a vague or unsupported problem statement.',
    },
    {
      name: 'Satisfaction',
      weight: 16,
      descriptor:
        'Full marks for a concrete solution explained well enough to be credible. Deduct for hand-waving or an underdeveloped remedy.',
    },
    {
      name: 'Visualization',
      weight: 14,
      descriptor:
        'Full marks for a vivid picture of the future with the solution, without it, or both. Deduct heavily where the speech jumps from solution straight to closing.',
    },
    {
      name: 'Action',
      weight: 14,
      descriptor:
        'Full marks for a specific, immediate, doable call to action. Deduct for vague closes such as "so think about it".',
    },
    {
      name: 'Sequence integrity',
      weight: 4,
      descriptor:
        'Full marks where the five steps appear in order with clear transitions. Deduct for steps out of order, blurred together, or missing.',
    },
    ...SHARED_DELIVERY,
  ],
};

const SCHEMES: Record<SpeechTemplateId | 'general', ScoringScheme> = {
  general: GENERAL_SCHEME,
  'general-public-speaking': GENERAL_SCHEME,
  'formal-organiser': ORGANISER_SCHEME,
  'formal-chiefguest': CHIEF_GUEST_SCHEME,
  debate: DEBATE_SCHEME,
  'monroe-motivated-sequence': MONROE_SCHEME,
};

export function getScoringScheme(templateId: SpeechTemplateId | null): ScoringScheme {
  return SCHEMES[templateId ?? 'general'] ?? GENERAL_SCHEME;
}

/** Renders a scheme as the marking instructions sent to the coach. */
export function formatSchemeForPrompt(scheme: ScoringScheme) {
  const rows = scheme.criteria
    .map((c) => `- ${c.name} (out of ${c.weight}): ${c.descriptor}`)
    .join('\n');

  const total = scheme.criteria.reduce((sum, c) => sum + c.weight, 0);

  return `MARKING SCHEME — ${scheme.label} (total ${total})
Mark each criterion out of its stated maximum, then add them up. The sum IS the overall score: do not pick a number first and justify it afterwards.

You must mark ALL ${scheme.criteria.length} criteria below. Every one gets its own line in the breakdown, even if the mark is low or the speech barely addressed it. Omitting a criterion is an error: the maximums add to exactly ${total}, so a breakdown that does not list all ${scheme.criteria.length} cannot possibly total correctly.

${rows}

How to award marks within a criterion:
- Award the full weight when the speech genuinely meets the descriptor. Do not withhold the top of a band because the speech was not exceptional overall.
- Award roughly three quarters when it is done competently with a nameable flaw.
- Award about half when the attempt is recognisable but clearly weak.
- Award a quarter or less only when the criterion is essentially absent.
- A criterion the speech had no opportunity to show (for example rebuttal in a 20-second clip) should be marked at three quarters rather than zero, and said so.

Arithmetic rules:
- The criterion marks must add up to the overall score you report. Add them one at a time and check the sum before writing it.
- The delivery criteria (pace, pausing, fluency) must be marked from the MEASURED DELIVERY DATA, not from impression.`;
}

/**
 * Recomputes the headline score from the marks the model actually awarded.
 *
 * Models are unreliable at addition: in testing they dropped criteria and
 * drifted 4-5 points from their own breakdown. The breakdown is the evidence
 * a user can check, so it wins — the reported total is corrected to match it
 * whenever every criterion is present and the maximums add up as expected.
 *
 * Returns null when the breakdown is incomplete, in which case the model's
 * own total stands rather than being replaced by a partial sum.
 */
export function totalFromBreakdown(
  breakdown: { label: string; value: string }[],
  scheme: ScoringScheme,
): number | null {
  const rows = breakdown.filter((r) => !/^total$/i.test(r.label));
  if (rows.length !== scheme.criteria.length) return null;

  let awarded = 0;
  let available = 0;

  for (const row of rows) {
    const match = row.value.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;
    awarded += Number(match[1]);
    available += Number(match[2]);
  }

  const expected = scheme.criteria.reduce((sum, c) => sum + c.weight, 0);
  // The maximums must match the scheme, or the model invented its own weights.
  if (available !== expected) return null;

  return Math.max(0, Math.min(100, awarded));
}

/** Delivery-only scheme used by the deeper analysis. */
export const DELIVERY_SCHEME: ScoringScheme = {
  label: 'Delivery',
  criteria: [
    {
      name: 'Pace & rhythm',
      weight: 20,
      descriptor:
        'Full marks for a rate in the 120-165 wpm range that varies with the material. Deduct for sustained rushing, near-metronomic delivery (variation under 12 wpm), and lurching between speeds.',
    },
    {
      name: 'Pausing',
      weight: 20,
      descriptor:
        'Full marks for deliberate pauses that give the audience room. Deduct for a pause rate under 2 per minute, unbroken runs over 30 seconds, and dead air that reads as stalling.',
    },
    {
      name: 'Fluency & filler',
      weight: 15,
      descriptor:
        'Full marks for clean phrasing with negligible filler. Deduct in proportion to the measured filler count, weighting fillers that follow a gap more heavily.',
    },
    {
      name: 'Tone & warmth',
      weight: 15,
      descriptor:
        'Full marks for a voice that invites the listener in and suits the material. Deduct for flatness, tension, or a detached delivery that holds the audience at arm’s length.',
    },
    {
      name: 'Conviction',
      weight: 18,
      descriptor:
        'Full marks for sounding certain of the material. Deduct for upspeak, trailing off at sentence ends, apologetic softening, and a voice that thins on the important lines.',
    },
    {
      name: 'Emphasis & energy',
      weight: 12,
      descriptor:
        'Full marks where key words carry audible weight and the energy varies with the content. Deduct where everything receives equal stress, or where filler carries more weight than the point.',
    },
  ],
};
