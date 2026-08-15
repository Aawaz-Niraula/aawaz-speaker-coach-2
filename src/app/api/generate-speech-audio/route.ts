import { NextRequest } from 'next/server';

import { DailyQuotaError, GuestLimitError, IdentityError, dailyQuotaResponse, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import {
  DEFAULT_ACCENT,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_OUTPUT_FORMAT,
  EXAMPLE_ACCENTS,
  buildPerformanceScript,
  getVoiceId,
  getVoiceSettings,
  type ExampleAccent,
  type ExampleVoice,
} from '@/lib/elevenlabs';

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Eleven v3 caps a single generation at 5,000 characters. Leave headroom for
// the audio tags the performance script injects.
const MAX_SCRIPT_CHARS = 4200;

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_SCRIPT_CHARS) : '';
}

function providerMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;

  // ElevenLabs errors look like { detail: { status, message } } or
  // { detail: [{ msg, loc }] } for validation failures.
  const detail = record.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const nested = detail as Record<string, unknown>;
    if (typeof nested.message === 'string') return nested.message;
    if (typeof nested.status === 'string') return nested.status;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).msg ?? '') : ''))
      .filter(Boolean)
      .join(' ');
  }

  if (typeof record.message === 'string') return record.message;
  return '';
}

async function synthesize(voiceId: string, text: string, apiKey: string) {
  const settings = getVoiceSettings();
  const url = `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;

  const res = await fetchWithRetryLimited('tts', url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: buildPerformanceScript(text),
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: settings,
      apply_text_normalization: 'auto',
    }),
  }, 1, 1200, 120000);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(providerMessage(data) || 'Speech audio generation failed.');
  }

  const audio = await res.arrayBuffer();
  if (audio.byteLength < 1000) {
    throw new Error('The voice model returned an empty audio file.');
  }

  return audio;
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const form = await req.formData();
    const text = cleanText(form.get('text'));
    const requestedVoice = String(form.get('exampleVoice') || 'female') as ExampleVoice;
    const requestedAccent = String(form.get('exampleAccent') || DEFAULT_ACCENT) as ExampleAccent;

    if (!text) {
      return Response.json({ error: 'First generate a text script.' }, { status: 400 });
    }

    if (requestedVoice !== 'male' && requestedVoice !== 'female') {
      return Response.json({ error: 'Invalid example voice.' }, { status: 400 });
    }

    if (!EXAMPLE_ACCENTS.includes(requestedAccent)) {
      return Response.json({ error: 'Invalid accent.' }, { status: 400 });
    }

    const voiceId = getVoiceId(requestedAccent, requestedVoice);
    if (!voiceId) {
      return Response.json(
        { error: 'That accent is not available yet. Please pick another one.' },
        { status: 400 },
      );
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return Response.json({ error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    const { userId } = await resolveAppUser(req, true, 'generate-speech-audio');
    const rateKey = `generate-speech-audio:${getClientKey(req, userId)}`;
    const rateLimit = checkRateLimit(rateKey, 8, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many voice generation requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const globalRateLimit = checkRateLimit('global:generate-speech-audio', 120, 5 * 60 * 1000);
    if (!globalRateLimit.allowed) {
      return Response.json(
        { error: 'Voice generation is busy right now. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': String(globalRateLimit.retryAfterSeconds) } },
      );
    }

    const audio = await synthesize(voiceId, text, ELEVENLABS_API_KEY);

    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="aawaz-${requestedAccent}-${requestedVoice}-speech.mp3"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof DailyQuotaError) {
      return dailyQuotaResponse();
    }
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }
    if (error instanceof IdentityError) {
      return identityErrorResponse();
    }

    const raw = error instanceof Error ? error.message : '';
    const lower = raw.toLowerCase();
    // Never surface the provider's raw "Internal Server Error" to the user.
    const message = !raw || lower.includes('internal') || lower.includes('server error')
      ? 'The voice service hit a snag. Please try again in a moment.'
      : raw;

    return Response.json({ error: message }, { status: 503 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
