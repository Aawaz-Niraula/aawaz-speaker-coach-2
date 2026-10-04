---
name: Aawaz Speaker Coach marketing site
description: A cinematic rehearsal stage, original feedback cards, liquid glass controls and alternating lavender surfaces.
colors:
  primary: "#c4b0ff"
  primary-hover: "#ddd6fe"
  accent-on-light: "#7450bb"
  ink: "#1a1430"
  dark: "#100d1b"
  canvas: "#0b0912"
  card: "#191424"
  light: "#f5f2fb"
  light-surface: "#f2dfe8"
  muted-on-light: "#574d75"
  muted-on-dark: "#bcb2d4"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial, sans-serif"
    fontSize: "clamp(64px, 7.3vw, 104px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque, Arial, sans-serif"
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "16px"
    lineHeight: 1.85
rounded:
  report-card: "24px"
  pill: "999px"
spacing:
  compact: "12px"
  group: "24px"
  mobile-section: "64px"
  desktop-section: "104px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
  button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.light}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
  report-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.light}"
    rounded: "{rounded.report-card}"
    padding: "22px 24px"
---

## Overview

The marketing site frames the coach's own report, phone preview and Aawax in a cinematic rehearsal setting. Custom plum-toned stage and preparation artwork create two distinct visual moments. Headings and whitespace establish hierarchy around these assets. This document records the implemented marketing frame only.

## Colors

Alternate soft blush pink (#f2dfe8) and dark purple section backgrounds. The blush reduces the glare of near-white sections while retaining purple text and accents. Expanded format rows use a deeper pastel mauve (#e8d2e3). Use the light accent on dark surfaces and the deeper accent on light surfaces. Preserve gradients inside the original product demonstrations; surrounding page surfaces are solid.

## Typography

Self-hosted Bricolage Grotesque is the heading face. Manrope is the reading face. The existing Cormorant Garamond wordmark remains. DM Mono stays inside report measurements. Headings carry no eyebrow labels.

## Layout

The container is capped at 1344px, with fluid 24px to 72px horizontal padding. Below 761px, sections become single-column. The report follows heading, phone, then cards on mobile. Above that breakpoint the phone sits beside the report heading and cards. Navigation switches to a menu at 1100px.

## Elevation & Depth

The hero uses a dark auditorium image with a legible left text column and a wide original feedback card in the foreground. A secondary rehearsal photograph sits beside the audience content. Restrict liquid glass depth to controls. Main page sections, format rows and questions use tonal differences and fine separators. No viewport blur or scrolling background animation is used on the marketing surface.

## Shapes

Preserve 24px report-card corners and the original rounded phone frame. Separate pill controls carry navigation and primary actions. Format and question rows are flat disclosures.

## Components

Primary buttons are at least 54px high; header controls are at least 44px. Controls use restrained lavender tinting, refracted edges and specular highlights. Format disclosures offer direct links to `/coach?template=<id>`. Questions use native disclosures with server-rendered answers. Both demo animations offer pause controls and respect reduced motion. The hero example toggles between the original and a tighter opening, with the score explicitly tied to the original example. Aawax retains its speaking tips and bounded pointer response.

All marketing buttons and button-like links use the adapted React Bits GlassSurface in `src/components/site/glass-surface.tsx`. The RGB displacement filter is reserved for compatible browsers; Safari and Firefox use the frosted fallback. Refraction surfaces are button-sized, observe size changes only and have no scroll or frame loop. Specular highlights follow the pointer. Reduced transparency receives opaque surfaces. Glass does not replace native link, button or disclosure semantics.

## Do's and Don'ts

- Do preserve the report imagery, mascot, card identity and light/dark rhythm.
- Do retain native scrolling, server-rendered copy and metadata.
- Do keep mobile content in a readable single column.
- Don't add eyebrow labels, em dashes, fabricated proof or unrelated gradients.
- Don't use this marketing specification to restyle the coach application.

## Route isolation

Next.js retains imported route styles during client navigation. Every rule in `src/app/(site)/site.css` must be scoped to `.site-shell` or gated by its presence. Landing glass uses `.site-liquid-surface`, never the coach application’s `.glass-surface` class. `style-isolation.test.ts` guards both boundaries. The coach layout and shared application styles remain authoritative for `/coach`.
