'use client';

/*
 * TEMPORARY. Renders the real report component with a sample report so the
 * homepage screenshot is the product's own UI. Deleted once the image is
 * captured; never deploy this route.
 */
import { FeedbackReport } from '@/components/feedback-report';

const SAMPLE = `📊 ANALYSIS
• Filler words: 4
• Speaking speed: 152 words/min (most speeches sit best at 130-160)
• Speed control: You held a steady pace through the opening, then sped up to 171 words a minute in the last third.
• Pauses: You paused 9 times in three minutes, but ran the final two sentences together without a gap.
• Hesitation: 3 of 4 fillers came after a gap, which reads as hunting for the next word rather than a speech habit.
• Clarity: Good
• Structure: A clear opening scene and two developed points, but the conclusion restates the second point instead of landing.
• Overall score: 68/100

📐 MARK BREAKDOWN
Structure & shape: 13/20
Logos — reasoning & evidence: 13/20
Ethos — credibility: 11/15
Pathos — emotional resonance: 9/13
Language & clarity: 7/10
Pace & rhythm: 6/8
Pausing: 4/7
Fluency & filler: 5/7
Total: 68/100

🔥 HONEST FEEDBACK
You opened with "the morning my sister missed her bus and walked four kilometres to school", which is a scene rather than a topic announcement, and it earned the room. Your second point rests on "a lot of students" with no figure behind it; "a lot" is an assertion, so give the number or drop the claim. You closed with "so that is why transport matters", which restates the point instead of landing it. End on the image you opened with: "She still walks. Nobody should have to."

🛠️ 3 SPECIFIC FIXES
1. The "so what?" test: after each claim in the body, write one sentence answering "why should this audience care", then read the speech with those sentences in place. Run it on all three claims before the next recording.
2. Mark the script with a slash at every intended pause and a double slash before the final line. Read it aloud five times, stopping fully at every slash, and time the last third so it stays under 160 words a minute.
3. Record the closing paragraph alone three times. Play each back and mark every "um" and "so" on the transcript, then replace each one with a full stop and a two-second silence.`;

const noop = () => undefined;

export default function ReportPreview() {
  return (
    <div className="min-h-screen bg-[#06060b] px-4 py-8">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(167,139,250,0.16),transparent_62%)]" />
      <div id="shot" className="relative mx-auto w-full max-w-[720px] rounded-[32px] bg-[#06060b] p-3">
        <FeedbackReport feedback={SAMPLE} copyText={noop} speakText={noop} />
      </div>
    </div>
  );
}
