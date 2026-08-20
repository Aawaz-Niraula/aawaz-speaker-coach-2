import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FeedbackReport } from './feedback-report';

const COMPLETE_REPORT = `📊 ANALYSIS
• Filler words: 0
• Speaking speed: 146 words/min
• Pauses: You left clear gaps after the rebuttal.
• Clarity: Good
• Structure: The supplied debate structure remained clear.
• Overall score: 78/100

📐 MARK BREAKDOWN
Clarity of stance: 14/15
Argument quality: 19/25
Rebuttal: 15/20
Structure: 10/12
Delivery: 20/28
Total: 78/100

🔥 HONEST FEEDBACK
The rebuttal was clear. The final sentence lost emphasis and needed a full pause before it.

🛠️ 3 SPECIFIC FIXES
1. Mark a double slash before the final sentence and read it five times.
2. Use a metronome at 140 bpm for three complete readings.
3. Record the rebuttal alone five times and check each pause.`;

const noop = () => undefined;

describe('FeedbackReport', () => {
  it('renders a guided report through the same structured evaluation template', () => {
    const html = renderToStaticMarkup(
      <FeedbackReport
        feedback={`<think>Private reasoning must not render.</think>\n\n${COMPLETE_REPORT}`}
        copyText={noop}
        speakText={noop}
      />,
    );

    expect(html).toContain('Coach report');
    expect(html).toContain('Analysis');
    expect(html).toContain('How this was marked');
    expect(html).toContain('Honest Feedback');
    expect(html).toContain('Your 3 Fixes');
    expect(html).not.toContain('Private reasoning');
    expect(html).not.toContain('&lt;think&gt;');
  });

  it('never exposes reasoning-only output in the fallback card', () => {
    const html = renderToStaticMarkup(
      <FeedbackReport
        feedback="<think>Internal scoring notes only."
        copyText={noop}
        speakText={noop}
      />,
    );

    expect(html).toContain('The coach could not format this report');
    expect(html).not.toContain('Internal scoring notes');
  });
});
