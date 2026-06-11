import { NextRequest } from 'next/server';

import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { getSpeechVoiceSample, setSpeechVoiceSampleProviderVoiceId } from '@/lib/db';
import { fetchWithRetry, fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { deleteProviderVoice, deleteUserProviderVoices, providerVoiceName } from '@/lib/provider-voice';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const DEFAULT_TTS_MODEL = 'XiaomiMiMo/MiMo-V2.5-tts';
const VOICE_CLONE_MODEL = 'XiaomiMiMo/MiMo-V2.5-tts-voiceclone';
const EXAMPLE_VOICES = {
  female: 'Mia',
  male: 'Milo',
} as const;
const STYLE_PROMPT =
  'Sound like a real human public speaker, not a robotic narrator. Deliver with confident, eloquent, brilliant stage presence: warm and persuasive, emotionally expressive, natural breath, varied pacing, lifelike pauses, subtle emphasis, rising energy on inspiring lines, thoughtful softness on reflective lines, and clear audience command. Use natural conversational rhythm, not flat monotone reading.';

type AudioMode = 'example' | 'clone';
type ExampleVoice = keyof typeof EXAMPLE_VOICES;

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim().slice(0, 6000) : '';
}

function providerMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return String((error as Record<string, unknown>).message);
  }
  if (typeof record.message === 'string') return record.message;
  if (Array.isArray(record.detail)) {
    return record.detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const detail = item as Record<string, unknown>;
        const message = typeof detail.msg === 'string' ? detail.msg : null;
        const location = Array.isArray(detail.loc) ? detail.loc.filter((part) => typeof part === 'string').join('.') : '';
        return message && location ? `${location}: ${message}` : message;
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof record.detail === 'string') return record.detail;
  return '';
}

function decodeBase64Audio(value: string) {
  const cleaned = value.includes(',') ? value.split(',').pop() || '' : value;
  if (!cleaned || cleaned.startsWith('http')) return null;

  try {
    const buffer = Buffer.from(cleaned, 'base64');
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return bytes.buffer;
  } catch {
    return null;
  }
}

function findAudioPayload(value: unknown): string | null {
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return decodeBase64Audio(value) ? value : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioPayload(item);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of ['audio', 'audio_base64', 'audio_data', 'data', 'output', 'result', 'url']) {
    const found = findAudioPayload(record[key]);
    if (found) return found;
  }

  return null;
}

async function readAudioResponse(res: Response) {
  const contentType = res.headers.get('content-type') || 'audio/ogg';

  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    const payload = findAudioPayload(data);
    if (payload?.startsWith('http')) {
      const audioRes = await fetchWithRetry(payload, {}, 1, 1000, 60000);
      if (audioRes.ok) {
        return readAudioResponse(audioRes);
      }
    }

    const audio = payload ? decodeBase64Audio(payload) : null;
    if (audio && audio.byteLength > 1000) {
      return { audio, contentType: 'audio/ogg; codecs=opus' };
    }

    const message = providerMessage(data);
    throw new Error(message || 'The voice model returned JSON instead of audio.');
  }

  const audio = await res.arrayBuffer();
  if (!audio.byteLength) {
    throw new Error('The voice model returned an empty audio file.');
  }

  return { audio, contentType };
}

async function synthesizeWithVoice(voiceId: string, text: string, modelId: string, token: string) {
  const res = await fetchWithRetryLimited('tts', `https://api.deepinfra.com/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: 'opus',
      language_code: 'en',
      style_instruction: STYLE_PROMPT,
    }),
  }, 1, 1000, 120000);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(providerMessage(data) || 'Speech audio generation failed.');
  }

  return readAudioResponse(res);
}

async function synthesizeDirect(modelId: string, text: string, token: string, voiceId?: string) {
  const body = JSON.stringify({
    text,
    voice: voiceId,
    voice_id: voiceId,
    style_instruction: STYLE_PROMPT,
    output_format: 'opus',
    language_code: 'en',
  });

  const res = await fetchWithRetryLimited('tts', `https://api.deepinfra.com/v1/inference/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  }, 1, 1000, 120000);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(providerMessage(data) || 'Speech audio generation failed.');
  }

  return readAudioResponse(res);
}

function extractVoiceId(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.voice_id === 'string') return record.voice_id;
  if (record.voice && typeof record.voice === 'object') {
    const nested = record.voice as Record<string, unknown>;
    if (typeof nested.voice_id === 'string') return nested.voice_id;
    if (typeof nested.id === 'string') return nested.id;
  }
  if (typeof record.id === 'string') return record.id;
  return '';
}

type VoiceAddAttempt = {
  ok: boolean;
  status: number;
  voiceId: string;
  message: string;
  fieldName: string;
};

async function addVoiceOnce(sample: File, userId: string, token: string, fieldName: string): Promise<VoiceAddAttempt> {
  const voiceForm = new FormData();
  voiceForm.append('name', providerVoiceName(userId));
  voiceForm.append('description', 'Short voice sample captured after speech analysis for practice speech playback.');
  voiceForm.append(fieldName, sample, sample.name || 'voice-sample.wav');

  const res = await fetchWithRetryLimited('voice', 'https://api.deepinfra.com/v1/voices/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: voiceForm,
  }, 0, 1000, 120000);

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, voiceId: extractVoiceId(data), message: providerMessage(data), fieldName };
}

async function addVoiceWithFallbacks(sample: File, userId: string, token: string) {
  const fieldNames = ['audio', 'files', 'files.items'];
  const attempts: VoiceAddAttempt[] = [];

  for (const fieldName of fieldNames) {
    const attempt = await addVoiceOnce(sample, userId, token, fieldName);
    attempts.push(attempt);

    if (attempt.ok && attempt.voiceId) {
      return attempt;
    }
  }

  return attempts.find((attempt) => attempt.message) ?? attempts[attempts.length - 1];
}

async function createVoice(sample: File, userId: string, token: string) {
  let attempt = await addVoiceWithFallbacks(sample, userId, token);

  if (!attempt.ok || !attempt.voiceId) {
    // The most common silent failure here is a full voice quota on the
    // provider account (old voices from replaced samples pile up). Reclaim
    // this user's stale voice slots and try once more.
    await deleteUserProviderVoices(userId, token);
    attempt = await addVoiceWithFallbacks(sample, userId, token);
  }

  if (!attempt.ok || !attempt.voiceId) {
    console.error('DeepInfra voice creation failed', {
      status: attempt.status,
      fieldName: attempt.fieldName,
      message: attempt.message,
      mimeType: sample.type,
      size: sample.size,
    });
    const detail = attempt.message?.toLowerCase() ?? '';
    const friendly = !attempt.message || detail.includes('internal') || detail.includes('server error')
      ? 'The voice service could not process your sample right now. Please try again in a moment.'
      : attempt.message;
    throw new Error(friendly);
  }

  return attempt.voiceId;
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const form = await req.formData();
    const mode = String(form.get('mode') || 'example') as AudioMode;
    const text = cleanText(form.get('text'));
    const requestedExampleVoice = String(form.get('exampleVoice') || 'female') as ExampleVoice;

    if (mode !== 'example' && mode !== 'clone') {
      return Response.json({ error: 'Invalid speech audio mode.' }, { status: 400 });
    }

    if (!text) {
      return Response.json({ error: 'First generate a text script.' }, { status: 400 });
    }

    if (mode === 'example' && !Object.prototype.hasOwnProperty.call(EXAMPLE_VOICES, requestedExampleVoice)) {
      return Response.json({ error: 'Invalid example voice.' }, { status: 400 });
    }

    const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
    if (!DEEPINFRA_API_KEY) {
      return Response.json({ error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    const { userId } = await resolveAppUser(req, true);
    const rateKey = `generate-speech-audio:${mode}:${getClientKey(req, userId)}`;
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

    let result: Awaited<ReturnType<typeof readAudioResponse>> | null = null;

    if (mode === 'clone') {
      const storedSample = await getSpeechVoiceSample(userId);
      if (!storedSample || storedSample.size_bytes < 3000 || storedSample.audio_data.byteLength < 3000) {
        return Response.json({ error: 'First do a speech analysis and try again.' }, { status: 400 });
      }

      if (storedSample.size_bytes > 12 * 1024 * 1024) {
        return Response.json({ error: 'Saved voice sample is too large. Record a shorter speech analysis and try again.' }, { status: 413 });
      }

      const sample = new File(
        [Buffer.from(storedSample.audio_data)],
        storedSample.filename || 'voice-sample.webm',
        { type: storedSample.mime_type || 'audio/webm;codecs=opus' },
      );

      let voiceId = storedSample.provider_voice_id || '';

      if (voiceId) {
        try {
          result = await synthesizeWithVoice(voiceId, text, VOICE_CLONE_MODEL, DEEPINFRA_API_KEY);
        } catch {
          // The stored voice is unusable — drop it on the provider too so it
          // doesn't occupy a voice slot forever.
          await deleteProviderVoice(voiceId, DEEPINFRA_API_KEY);
          voiceId = '';
        }
      }

      if (!voiceId) {
        voiceId = await createVoice(sample, userId, DEEPINFRA_API_KEY);
        await setSpeechVoiceSampleProviderVoiceId(userId, voiceId);

        // A just-created voice can need a moment before it is usable;
        // retry once after a short pause instead of failing outright.
        try {
          result = await synthesizeWithVoice(voiceId, text, VOICE_CLONE_MODEL, DEEPINFRA_API_KEY);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          result = await synthesizeWithVoice(voiceId, text, VOICE_CLONE_MODEL, DEEPINFRA_API_KEY);
        }
      }
    } else {
      const voiceId = EXAMPLE_VOICES[requestedExampleVoice];
      try {
        result = await synthesizeWithVoice(voiceId, text, DEFAULT_TTS_MODEL, DEEPINFRA_API_KEY);
      } catch {
        result = await synthesizeDirect(DEFAULT_TTS_MODEL, text, DEEPINFRA_API_KEY, voiceId);
      }
    }

    if (!result) {
      throw new Error('Speech audio generation failed.');
    }

    return new Response(result.audio, {
      headers: {
        'Content-Type': result.contentType.includes('audio/') ? result.contentType : 'audio/ogg; codecs=opus',
        'Content-Disposition': `attachment; filename="aawaz-${mode}-speech.opus"`,
        'Cache-Control': 'no-store',
        'X-Aawaz-Style-Prompt': STYLE_PROMPT,
      },
    });
  } catch (error) {
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
