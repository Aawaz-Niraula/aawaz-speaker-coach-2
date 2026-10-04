'use client';

import { GlassSurface } from './glass-surface';

import { useId, useRef, useState, type PointerEvent } from 'react';
import { CoachMascot } from '@/components/mascot';

const TIPS = [
  'Pause where one thought ends and the next begins.',
  'Start with the point you want your audience to remember.',
  'Pick one thing from your report to improve on the next take.',
];

/** Bounded pointer response adapted from React Bits Magnet. See THIRD_PARTY_NOTICES.md. */
export function LandingAawax({ marking }: { marking: boolean }) {
  const character = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const [tip, setTip] = useState(-1);

  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-3, Math.min(3, (event.clientX - bounds.left - bounds.width / 2) / 8));
    const y = Math.max(-3, Math.min(3, (event.clientY - bounds.top - bounds.height / 2) / 8));
    if (character.current) character.current.style.transform = `translate(${x}px, ${y}px) rotate(${x}deg)`;
  }

  return (
    <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-4">
      <button
        type="button"
        className="glass-control aawax-tip-button h-16 w-16 shrink-0 cursor-pointer rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/[0.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4b0ff]"
        aria-label="Get a speaking tip from Aawax"
        aria-describedby={tipId}
        onPointerMove={followPointer}
        onPointerLeave={() => { if (character.current) character.current.style.transform = ''; }}
        onClick={() => setTip((previous) => (previous + 1) % TIPS.length)}
      >
        <GlassSurface />
        <span ref={character} className="aawax-tip-character block">
          <CoachMascot size={62} float={false} motionEnabled={false} mood={marking ? 'listen' : 'coach'} />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-5 font-medium text-[#c4b0ff]">Aawax <span className="font-normal text-[#ada2c6]">· Tap for a tip</span></p>
        <p id={tipId} aria-live="polite" aria-atomic="true" className="mt-1 grid text-sm leading-[1.5] text-[#ddd6eb]">
          {/* Reserve the longest tip at every width so tapping never moves the page. */}
          {TIPS.map((text) => <span key={text} aria-hidden="true" className="invisible [grid-area:1/1]">{text}</span>)}
          <span className="[grid-area:1/1]">{tip < 0 ? 'A little practice, one speech at a time.' : TIPS[tip]}</span>
        </p>
      </div>
    </div>
  );
}
