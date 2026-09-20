# DECLARE Instagram Reel Script

**Format:** 1080x1920, 81.0s, ElevenLabs voice `jfIS2w2yJi0grJZPyEsk`
**Model:** `eleven_v3` (required, audio tags only work on v3)
**Tone:** how a 17 year old actually talks. Short sentences, contractions. Always "we", never "I".

## Copy rules

No em-dashes anywhere. No small grey kicker labels above headlines. No "it's not X, it's Y"
reversals. No rhetorical questions the narrator answers. These all read as AI-written, which is
fatal for a campaign about AI literacy.

Always "we", never "I". The tagline is "By students, for students".

Instagram moderation: avoid violent phrasing even when quoting public fear. The third search
query was "will ai kill us" and became "is ai dangerous?" to stay clear of automated filters.

## Tagged narration (as sent to ElevenLabs)

```
[curious] These are the things people actually type into Google. [thoughtful] Every single day.
[softly] And almost none of us know enough to answer them.

[serious] Fifty two percent of people say AI makes them nervous. Seventy nine percent think it's
coming for their jobs. [drawn out] And fake videos went from half a million to eight MILLION in
two years.

[thoughtful] In America, about sixty percent of high schools teach this stuff. [sighs] In Nepal,
ninety one percent of us have heard of AI, but hardly any of us get taught how it actually
works. [firmly] That gap is the whole problem.

[warmly] So we started DECLARE. By students, for students.

[excited] We start with the simplest algorithms and build all the way up to attention, which is
what's running inside every chatbot you've used. [confident] No hype. Just the math. [warmly]
Then we teach them how to explain it to everyone else.

[proudly] Nine schools so far. Over five hundred students. [emphatic] All of it free. The school
pays nothing.

[sincere] Once you see how it works, it stops being scary. [encouraging] So share this. Or tell us
about your school. [warmly] Insights, for everyone.
```

Tag technique: ellipses force natural pauses, ALL CAPS on "MILLION" adds emphasis, `[sighs]`
carries the turn from the US comparison into the Nepal problem.

**Verify every regenerated clip's words.** v3 sometimes drops trailing words: one take of the
closing line ended on "Insights" instead of "Insights for everyone", and neither the clip
duration nor its audio levels revealed it. Check with
`npx hyperframes transcribe assets/audio/vo-sN.mp3 -d .` (writes `transcript.json`; delete it
after). The comma in "Insights, for everyone" gives the model a beat so the ending lands.

## Timings (as rendered, 81.0s total)

| Scene | Start | Dur | Beat |
|---|---|---|---|
| 1 Search | 0.0 | 11.0 | Google bar types "will ai take my job?", "will ai replace humans?", "is ai dangerous?" with autocomplete rows and typing SFX |
| 2 Stats | 11.0 | 14.5 | 52%, 79%, deepfakes 500K to 8M, each sourced on screen |
| 3 Gap | 25.5 | 17.0 | USA 60% vs Nepal "few" comparison bars, then "That gap is the whole problem" |
| 4 Logo | 42.5 | 5.6 | Green flood reveal, DECLARE, "By students, for students" |
| 5 Teach | 48.1 | 14.8 | Curriculum ladder, then 9 photos flipping every 0.5s |
| 6 Proof | 62.9 | 8.1 | 9 schools / 500+ students, "Completely free" |
| 7 CTA | 71.0 | 10.0 | "Insights for everyone", Instagram-style share button with a cursor that taps it, Bring us to your school, @declare_now, logo lockup |

Scene durations are driven by the measured narration clips. If the script changes: re-measure
with ffprobe, then update the scene slots, the `<audio>` elements, each affected scene's own
`data-duration` and internal GSAP beats, and rebuild the music bed to the new total. A scene
must be at least as long as its narration clip or `check` fails on overlapping track 10 clips.
Spread each scene's beats across its FULL slot; animations that finish early make the video feel
faster than the voice.

## Sources (on-screen, small type)

- Ipsos / Stanford HAI AI Index 2026, 52% say AI makes them nervous
- Quinnipiac University Poll 2026, 79% expect AI to cut jobs
- European Parliamentary Research Service, deepfakes 500K (2023) to 8M (2025)
- Code.org State of AI + CS Education 2025, 60% of US high schools offer CS/AI
- AISCliteracy arXiv:2506.23321, 91% of Chitwan grade 9-12 students have heard of AI while
  schools rate low on actually providing it

The two bars in scene 3 come from different survey instruments, so each carries its own source
line and the Nepal bar is labelled "few" rather than a fabricated percentage. Inventing a number
there would be the exact failure this campaign exists to fight.
