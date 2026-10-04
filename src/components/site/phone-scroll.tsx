'use client';

import { GlassSurface } from './glass-surface';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';

import reportPhone from '../../../public/report-phone.png';

/**
 * The coach's report, scrolling inside a phone.
 *
 * The scroll is a CSS transform on a loop, which composites without
 * repainting, and it is paused whenever the phone is off screen. Nothing in
 * this repo gets to animate behind a part of the page nobody is looking at.
 */
export function PhoneScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.2 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative mx-auto w-[266px] sm:w-[286px] lg:mx-0">
      {/* Light thrown by the screen onto the ground behind it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 -z-10 bg-[radial-gradient(ellipse_50%_45%_at_50%_45%,rgba(167,139,250,0.22),transparent_70%)]"
      />

      <div className="report-phone-frame relative rounded-[44px] border border-white/12 bg-[linear-gradient(150deg,#26243a,#101018)] px-[9px] pb-[15px] pt-[9px] shadow-[0_50px_110px_rgba(2,6,23,0.85),inset_0_1px_0_rgba(255,255,255,0.14)]">
        <div className="relative overflow-hidden rounded-[36px] rounded-b-[30px] bg-[#06060b]">
          <span
            aria-hidden
            className="absolute left-1/2 top-0 z-30 h-[26px] w-[104px] -translate-x-1/2 rounded-b-[14px] bg-[#0f0e18] shadow-[0_1px_0_rgba(255,255,255,0.06)]"
          />
          <div className="h-[460px] overflow-hidden sm:h-[520px]">
            <div className={`report-scroll${visible && !paused ? '' : ' report-scroll--paused'}`}>
              <Image
                src={reportPhone}
                alt="A finished coach report scrolling on a phone: a score of 68 out of 100 marked Competent, then the analysis, the mark breakdown, the honest feedback and three fixes."
                loading="lazy"
                placeholder="blur"
                quality={62}
                sizes="286px"
                className="w-full"
              />
            </div>
          </div>
          {/* Screen falloff at the top and bottom, so the loop has no seam. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,#06060b_30%,transparent)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,#06060b_30%,transparent)]"
          />
        </div>
      </div>
      <button
        type="button"
        className="glass-control report-playback mx-auto mt-6 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#7c5cde]/20 px-4 text-sm font-medium text-[#574d75] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7450bb]"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? 'Play report preview' : 'Pause report preview'}
      >
        <GlassSurface />
        {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        {paused ? 'Play preview' : 'Pause preview'}
      </button>
    </div>
  );
}
