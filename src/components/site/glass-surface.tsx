'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';

/**
 * Button-sized adaptation of React Bits GlassSurface by David Haz.
 * Keeps its RGB displacement map and frosted fallback. The semantic button or
 * link remains the parent, so neither focus nor click handling is intercepted.
 * See THIRD_PARTY_NOTICES.md for source and license.
 */
export function GlassSurface() {
  const id = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const surface = useRef<HTMLSpanElement>(null);
  const map = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const element = surface.current;
    const control = element?.parentElement;
    if (!element || !control) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const transparent = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const unsupported = /Firefox|Version\/.*Safari/.test(navigator.userAgent);
    element.dataset.svg = String(!unsupported && CSS.supports('backdrop-filter', `url(#${id})`));

    // Rebuild only on size changes, never on scroll or pointer movement.
    const resize = () => {
      const { width: w, height: h } = element.getBoundingClientRect();
      if (!w || !h) return;
      const edge = Math.min(w, h) * 0.035;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="r" x1="100%" x2="0%"><stop stop-color="#0000"/><stop offset="1" stop-color="red"/></linearGradient><linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="#0000"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="${w}" height="${h}" fill="black"/><rect width="${w}" height="${h}" rx="${h / 2}" fill="url(#r)"/><rect width="${w}" height="${h}" rx="${h / 2}" fill="url(#b)" style="mix-blend-mode:difference"/><rect x="${edge}" y="${edge}" width="${w - edge * 2}" height="${h - edge * 2}" rx="${h / 2}" fill="hsl(0 0% 50% / .93)" style="filter:blur(7px)"/></svg>`;
      map.current?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(svg)}`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches || transparent.matches) return;
      const rect = control.getBoundingClientRect();
      control.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
      control.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
    };
    const leave = () => {
      control.style.removeProperty('--glass-x');
      control.style.removeProperty('--glass-y');
    };
    control.addEventListener('pointermove', move);
    control.addEventListener('pointerleave', leave);
    return () => {
      observer.disconnect();
      control.removeEventListener('pointermove', move);
      control.removeEventListener('pointerleave', leave);
    };
  }, [id]);

  return (
    <span ref={surface} className="site-liquid-surface" aria-hidden="true" style={{ '--glass-filter': `url(#${id})` } as CSSProperties}>
      <svg className="site-liquid-filter" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          <filter id={id} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={map} width="100%" height="100%" preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-65" xChannelSelector="R" yChannelSelector="G" result="dispRed" />
            <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-60" xChannelSelector="R" yChannelSelector="G" result="dispGreen" />
            <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="green" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="-55" xChannelSelector="R" yChannelSelector="G" result="dispBlue" />
            <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" />
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        </defs>
      </svg>
    </span>
  );
}
