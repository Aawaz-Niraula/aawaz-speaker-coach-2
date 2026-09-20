---
workflow: general-video
flow: automation
storyboard: no
message: "AI isn't a black box or a sentient threat — it's math, and any student can learn it"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 60s
angle: campaign
---

## Intent

A recruitment and awareness reel for DECLARE, a student-led AI literacy campaign teaching
14–17 year olds in Nepali schools. Opens on the misinformation and fear problem — with real,
sourced statistics — then pivots to the campaign as the answer, shows proof from nine schools,
and closes on a share/contact call to action.

Tone is warm and personal, student-to-student. Not a lecture, not a corporate PSA. The narrator
is a peer who is worried about the same things the viewer is.

## Assets

- assets/photos/p1–p9.jpg — real campaign photos from 8 schools; the montage beat. p1 is a wide
  group shot (letterbox, do not hard-crop). p2 shows the whiteboard "Types of AI / ANI / AGI /
  LLM" — use it where narration mentions what is taught.
- assets/logo.png — DECLARE logo, white background keyed to transparent. Dark text version.
- assets/logo-light.png — same logo with the wordmark inverted white, for dark backgrounds.
- ../SCRIPT.md — the scene-by-scene script and the tagged narration sent to ElevenLabs.

## Customizations

- Animated stat charts with visible source attribution on every external figure.
- Count-up counters on the 9 schools / 500+ students beat.
- Fast photo montage, ~0.4s per photo, with a page-flip SFX per cut.
- Logo reveal as the hinge between the problem half and the solution half.

## Notes

- **Every external statistic must show its source on screen.** A campaign against
  misinformation cannot itself display unsourced numbers. Campaign figures (9 schools,
  ~500 students) are the user's own and need no citation.
- Do not state the campaign length. It runs 1–3 days depending on the school; the user wants
  this vague or absent.
- Narration is pre-generated via ElevenLabs (voice jfIS2w2yJi0grJZPyEsk, model eleven_v3 with
  audio tags). Do not regenerate with another engine. Real voice duration overrides estimates.
- Not signed in to HeyGen; SFX are synthesized locally rather than pulled from a provider.
