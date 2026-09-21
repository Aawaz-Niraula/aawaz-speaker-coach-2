'use client';

/*
 * TEMPORARY. Isolates the marking animation so it can be recorded for review.
 * Deleted together with the rest of report-preview once approved.
 */
import { MarkingDemo } from '@/components/site/marking-demo';

export default function AnimPreview() {
  return (
    <div className="min-h-[220vh] bg-[#06060b] px-4">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(167,139,250,0.16),transparent_70%)]" />
      {/* Pushed below the fold so scrolling to it triggers the animation,
          which is exactly how a visitor will meet it. */}
      <div className="h-[130vh]" />
      <div id="stage" className="relative mx-auto w-full max-w-[680px] pb-[60vh]">
        <MarkingDemo />
      </div>
    </div>
  );
}
