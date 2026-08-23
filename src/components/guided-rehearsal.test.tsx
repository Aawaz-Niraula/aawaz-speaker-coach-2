import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { RehearsalScript } from '@/lib/rehearsal';

import { GuidedRehearsal } from './guided-rehearsal';

const rehearsal: RehearsalScript = {
  speechId: 'test-speech',
  script: '[breathe] Begin with a clear idea. Then make the idea useful. End with one memorable action.',
  topic: 'A clear rehearsal',
  templateId: 'general-public-speaking',
  templateLabel: 'General Public Speaking',
};

describe('GuidedRehearsal', () => {
  it('keeps primary rehearsal actions visible while secondary phone controls stay collapsed', () => {
    const markup = renderToStaticMarkup(
      <GuidedRehearsal
        open
        rehearsal={rehearsal}
        isRecording={false}
        seconds={0}
        maxSeconds={300}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Rehearsal script"');
    expect(markup).toContain('aria-label="Previous script line"');
    expect(markup).toContain('aria-label="Next script line"');
    expect(markup).toContain('Start rehearsal');
    expect(markup).toContain('aria-controls="mobile-reading-settings"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('id="mobile-reading-settings"');
  });

  it('renders the recording action and locks pace controls during a rehearsal', () => {
    const markup = renderToStaticMarkup(
      <GuidedRehearsal
        open
        rehearsal={rehearsal}
        isRecording
        seconds={18}
        maxSeconds={300}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('Stop &amp; analyze');
    expect(markup).toContain('Recording 0:18');
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('does not render the dialog when it is closed', () => {
    const markup = renderToStaticMarkup(
      <GuidedRehearsal
        open={false}
        rehearsal={rehearsal}
        isRecording={false}
        seconds={0}
        maxSeconds={300}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toBe('');
  });
});
