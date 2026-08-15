# How Aawaz scores a speech

Every speech is marked against a **weighted scheme totalling 100**. The coach
marks each criterion out of its stated maximum and the marks are added up — the
sum *is* the score. Nothing is picked first and justified afterwards.

The breakdown is shown to the user under **"How this was marked"** on every
report, so any score can be checked line by line.

Schemes live in [`src/lib/scoring.ts`](src/lib/scoring.ts).

---

## Two independent scores

| Report | What it marks | When |
|---|---|---|
| **Standard analysis** | Content, structure, argument + delivery | Automatically after every recording |
| **Deeper Analysis** | Delivery only — pace, pausing, tone, conviction | On demand, when the user asks |

The delivery score is **anchored within ~12 points** of the content score, so
the two reports cannot contradict each other. It may differ further when the
evidence justifies it (strong arguments delivered flatly, or thin content
carried by excellent delivery), but the report must say so explicitly.

---

## Where the marks come from

### Measured, not judged

These come from Whisper's word-level timestamps and are treated as
authoritative — the prompt forbids the coach from contradicting them:

| Metric | Definition |
|---|---|
| Words per minute | Overall, plus a curve every 15 seconds |
| Pace variation | Standard deviation. Under 12 wpm = near-metronomic; over 45 = erratic |
| Pauses | Every gap ≥ 0.45s, with timestamps |
| Pause rate | Per minute. Under 2 flags rushing |
| Dead air | Pauses ≥ 2.5s |
| Longest unbroken run | Flagged over 30s |
| Silence ratio | Percentage of the recording |
| Filler words | Total, and how many followed a gap (hesitation vs verbal habit) |

### Judged by the coach

Structure, argument, evidence, protocol, register — read from the transcript
against the active rubric.

### Heard by Gemini (Deeper Analysis only)

Tone, emotion, conviction, emphasis — these exist only in the audio and cannot
be recovered from a transcript.

---

## Awarding marks within a criterion

| Award | When |
|---|---|
| Full weight | The speech genuinely meets the descriptor |
| ~75% | Done competently, with a nameable flaw |
| ~50% | Recognisable attempt, clearly weak |
| ≤25% | The criterion is essentially absent |
| ~75% | The speech had no *opportunity* to show it (e.g. rebuttal in a 20-second clip) — and the report says so |

---

## Scheme 1 — General public speaking (no template)

Judged on the **ELP framework**: Ethos, Logos, Pathos.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Structure & shape | **20** | Opening that establishes purpose fast, body of distinct points with transitions, ending that lands |
| Logos — reasoning & evidence | **20** | Claims supported by facts, figures, examples, sound cause-and-effect |
| Ethos — credibility | **15** | Trust earned through experience, knowledge, or demonstrated authority |
| Pathos — emotional resonance | **13** | Imagery, story or stakes that make the audience *feel* the issue |
| Language & clarity | **10** | Precise, concrete wording for an audience hearing it once |
| Pace & rhythm | **8** | 120–165 wpm, varying with the material |
| Pausing | **7** | Deliberate pauses giving the audience room |
| Fluency & filler | **7** | Clean phrasing, negligible filler |
| | **100** | |

---

## Scheme 2 — Formal: Organising Party

An operational role. Protocol and control of the room outrank rhetoric.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Protocol & acknowledgement order | **25** | Guests greeted in correct order of precedence, formalities observed |
| Purpose & occasion framing | **18** | Why everyone is gathered, established in the opening moments |
| Sequencing & control | **17** | Deliberate movement between segments, authoritative hand-over |
| Formal register | **15** | Composed, dignified language sustained throughout |
| Concision | **3** | No padding, no repeated thanks |
| Pace & rhythm | **8** | *(shared)* |
| Pausing | **7** | *(shared)* |
| Fluency & filler | **7** | *(shared)* |
| | **100** | |

---

## Scheme 3 — Formal: Chief Guest

Ceremonial. Dignity and honouring the occasion carry the weight.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Ceremonial protocol | **22** | Respect and occasion established immediately, formalities correct |
| Dignity of register | **20** | Polished, elevated language — warm without becoming chatty |
| Recognition & significance | **18** | Occasion and people properly acknowledged, significance made felt |
| Message & sequencing | **15** | Clear line through occasion → recognition → significance → message |
| Closing | **3** | Intentional, ceremonious ending |
| Pace & rhythm | **8** | *(shared)* |
| Pausing | **7** | *(shared)* |
| Fluency & filler | **7** | *(shared)* |
| | **100** | |

---

## Scheme 4 — Debate

Competitive argument. Clash and evidence dominate.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Argument quality & support | **25** | Separate, well-ranked arguments, each carried by evidence |
| Rebuttal & clash | **20** | Opposing case anticipated, refuted directly, weighed comparatively |
| Clarity of stance | **15** | Claim stated early, unambiguously, held consistently |
| Structure & signposting | **12** | Listener always knows which argument is being made |
| Assertive control | **6** | Confident, strategically paced, in command of the material |
| Pace & rhythm | **8** | *(shared)* |
| Pausing | **7** | *(shared)* |
| Fluency & filler | **7** | *(shared)* |
| | **100** | |

> Rebuttal is weighted at 20 because a debate speech that ignores the other
> side has not debated, however well argued its own case is.

---

## Scheme 5 — Monroe's Motivated Sequence

Five fixed steps. Each is marked, and order counts.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Need | **16** | A real, urgent problem, evidenced and made personally relevant |
| Satisfaction | **16** | A concrete solution, explained well enough to be credible |
| Attention | **14** | Opening that seizes attention — hook, fact, story or question |
| Visualization | **14** | Vivid picture of the future with the solution, without it, or both |
| Action | **14** | Specific, immediate, doable call to action |
| Sequence integrity | **4** | Five steps in order, with clear transitions |
| Pace & rhythm | **8** | *(shared)* |
| Pausing | **7** | *(shared)* |
| Fluency & filler | **7** | *(shared)* |
| | **100** | |

> Need and Satisfaction carry the most because they are the persuasive core;
> a speech that skips Visualization is penalised through that criterion rather
> than being failed outright.

---

## Scheme 6 — Delivery (Deeper Analysis)

Delivery only. Content and structure are explicitly excluded.

| Criterion | Weight | Full marks for |
|---|---:|---|
| Pace & rhythm | **20** | 120–165 wpm, varying with the material |
| Pausing | **20** | Deliberate pauses giving the audience room |
| Conviction | **18** | Sounding certain — no upspeak, no trailing off, no thinning on key lines |
| Fluency & filler | **15** | Clean phrasing, negligible filler |
| Tone & warmth | **15** | A voice that invites the listener in and suits the material |
| Emphasis & energy | **12** | Key words carry audible weight; energy varies with content |
| | **100** | |

---

## Grade labels

| Score | Label |
|---|---|
| 90–100 | Exceptional |
| 80–89 | Commanding |
| 70–79 | Strong |
| 55–69 | Competent |
| 40–54 | Developing |
| 25–39 | Rough |
| 0–24 | Early Days |

**Floor rule:** if the speaker stayed on topic and could be followed, the score
starts at 45 regardless of how rough the delivery was. Below 45 means the
speech genuinely failed to communicate. Under 25 is reserved for recordings
that are essentially unusable.

---

## Reliability

The coach assigns the marks — this is judgement of speech, not counting
widgets — so expect small variation between runs on identical audio.

Two things reduce that:

1. **The measured half is deterministic.** Pace, pauses and filler counts come
   from timestamps, not opinion.
2. **The total is recomputed server-side.** `totalFromBreakdown()` in
   `src/lib/scoring.ts` sums the awarded marks and overrides the headline
   number if the coach's own arithmetic drifted. It only does this when every
   criterion is present and the maximums match the scheme; otherwise the
   coach's total stands rather than being replaced by a partial sum.

---

## Verification

All five content schemes were tested end to end with purpose-written speeches
generated through ElevenLabs — one per format, each written to exercise that
rubric's specific demands.

| Scheme | Criteria marked | Maximums total | Marks sum to score |
|---|---|---|---|
| General (ELP) | 8 / 8 | 100 | ✅ |
| Organising Party | 8 / 8 | 100 | ✅ |
| Chief Guest | 8 / 8 | 100 | ✅ |
| Debate | 8 / 8 | 100 | ✅ |
| Monroe's | 9 / 9 | 100 | ✅ |

Each rubric fired its own criteria: the organiser speech was marked on protocol
and sequencing, the debate speech on rebuttal and clash, the Monroe speech on
all five steps in order.

Two defects were found and fixed during that testing:

- **Dropped criteria.** The first run omitted Logos, Ethos and Pathos from the
  general scheme, accounting for only 52 of 100 marks. The prompt now states
  the exact criterion count and that omitting any is an error.
- **Arithmetic drift.** Reported totals were 4–5 points away from the model's
  own marks. `totalFromBreakdown()` now recomputes the total from the
  breakdown, and rewrites both the headline score and the total line to match.
