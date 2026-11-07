import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ANALYSIS_MODELS, TRANSCRIPTION_MODELS } from '@/lib/ai';

import { PRIVACY_CONTACT, PrivacyTermsDialog } from './privacy-terms';

const html = renderToStaticMarkup(<PrivacyTermsDialog open onClose={() => {}} />);
const text = html.replace(/<[^>]+>/g, ' ');

describe('privacy & terms notice', () => {
  it('names every service that receives user data, and how to reach us', () => {
    for (const name of ['Vercel', 'Turso', 'DeepInfra', 'Gemini', 'ElevenLabs', 'Google sign-in']) {
      expect(text).toContain(name);
    }
    expect(html).toContain(`mailto:${PRIVACY_CONTACT}`);
  });

  it('keeps internal details out of the user-facing text', () => {
    const internals = [
      ...ANALYSIS_MODELS, ...TRANSCRIPTION_MODELS,
      'DeepSeek', 'Whisper', 'HMAC', 'rate limit', 'quota', 'API key', 'BETTER_AUTH', 'TURSO_',
    ];
    for (const term of internals) expect(text.toLowerCase()).not.toContain(term.toLowerCase());
  });

  it('uses no em-dashes', () => {
    expect(text).not.toContain('—');
  });

  it('lives in the coach only, never on the public site', () => {
    const site = readFileSync(join(__dirname, '../app/(site)/page.tsx'), 'utf8');
    expect(site).not.toContain('privacy-terms');
    const coach = readFileSync(join(__dirname, '../app/coach/page.tsx'), 'utf8');
    expect(coach).toContain("from '@/components/privacy-terms'");
  });
});
