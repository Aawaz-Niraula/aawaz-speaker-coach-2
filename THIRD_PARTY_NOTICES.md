# React Bits

The bounded pointer response in `src/components/site/landing-aawax.tsx` is adapted from
[React Bits Magnet](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/Magnet/Magnet.tsx).
The adaptation uses local pointer events, a three pixel travel limit, and reduced motion support.
Aawax's artwork remains the project's original SVG.

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## React Bits GlassSurface

`src/components/site/glass-surface.tsx` adapts the React Bits GlassSurface RGB displacement map and SVG filter, with a CSS frost fallback for Safari and Firefox. The implementation is restricted to button-sized surfaces and adds native control semantics, ResizeObserver cleanup, reduced-transparency support and pointer highlights without a frame loop.

Source: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Components/GlassSurface/GlassSurface.tsx

Styles: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Components/GlassSurface/GlassSurface.css

Copyright (c) 2026 David Haz. The React Bits MIT license with Commons Clause reproduced above applies.

## Homepage artwork

`public/images/rehearsal-stage.webp` and `public/images/rehearsal-notes.webp` are generated editorial artwork created for this homepage. `public/images/rehearsal-stage-mobile.webp` is a portrait crop of the same stage artwork. They depict a fictional rehearsal setting, not a customer, venue endorsement or product screenshot. Originals are retained in the session generated-images directory.

## Allura

The self-hosted header font `src/app/fonts/allura-400.woff2` is the Latin subset of [Allura](https://github.com/google/fonts/tree/main/ofl/allura), distributed under the SIL Open Font License 1.1. The full license and copyright notice are included in `src/app/fonts/allura-OFL.txt`.
