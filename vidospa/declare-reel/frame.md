# DECLARE reel — design spec

## Concept angle

The video enacts its own thesis. It opens inside a Google search bar, typing the questions
people actually ask about AI, because that search box is where the fear lives. The problem half
is near-black with green used coldly and sparingly; the campaign half floods with green. Fear
looks like static, understanding looks like structure. The logo reveal is the hinge, the moment
the lights come on.

The whole piece stays on ONE ground: near-black throughout. There is no white/light half. Early
versions used a near-white campaign half and it read as flat and unfinished.

## Palette

Green and black. Green is the signal colour, black the ground; every neutral is tinted green
so nothing reads as a stock grey. Never pure `#000` or `#fff`.

| Token         | Value     | Use                                              |
| ------------- | --------- | ------------------------------------------------ |
| `--ink`       | `#05100A` | near-black ground, green-tinted                  |
| `--ink-soft`  | `#0C1E14` | raised surfaces on dark                          |
| `--paper`     | `#EAF3EC` | light ground for the campaign half, green-tinted |
| `--accent`    | `#3DDC84` | the signal green                                 |
| `--accent-dp` | `#12A45C` | deeper green for fills and chart bars            |
| `--dim`       | `#4F6B58` | muted green-grey, the "absence" bar and inactive |
| `--fg-dark`   | `#E6F5EA` | text on dark                                     |
| `--fg-light`  | `#05100A` | text on light                                    |

The problem half is black with green used sparingly and coldly. The campaign half floods with
green. Absence and shortfall are shown as **dim/desaturated green**, not as a second hue, so the
whole piece stays two colours. Contrast still has to pass WCAG AA on real text.

## Typography

**Pairing tension:** institutional shouting vs. actual math.

- **Archivo Black** (400 only) — statements, headlines, the fear claims. The register of a
  newspaper headline and a scare graphic. Heavy, unarguable, loud.
- **JetBrains Mono** (400/700) — every number, source citation, and technical label. The
  register of what AI actually is: code and arithmetic.

The disagreement is the thesis. Headlines shout at you; the mono tells you what's true.
Sources are always mono, always small, always present.

- Headlines ≥ 100px (in-feed viewing — Reels plays small)
- Body ≥ 34px
- Data labels / sources ≥ 24px
- Tracking −0.03em on display sizes
- `tabular-nums` on every counter and stat

## Background layer

Problem half (4 decoratives, one shared slow breath):
1. Radial glow, `--alarm` tinted, very low opacity, breathing
2. Drifting noise/grain overlay
3. Ghost text — fragmented claim words at 5% opacity, very large, slow drift
4. Hairline horizontal rules that jitter

Campaign half (4 decoratives, one shared breath):
1. Radial glow, `--accent` tinted, breathing
2. Faint geometric grid — structure replacing static
3. Ghost mathematical notation (Σ, softmax fragment) at 4% opacity
4. Accent hairlines, steady and level (the jitter is gone)

## Motion

0.3–0.6s entrances, varied eases, combined transforms. The problem half cuts hard and jitters;
the campaign half eases and settles. Motion carries the same argument as the color.

## Non-negotiables

- Every external statistic carries a visible mono source line. No exceptions.
- Campaign duration is never stated.
- Contrast must pass WCAG AA with decoratives removed.
