import { NextRequest } from 'next/server';

import { getSpeechVoiceSample } from '@/lib/db';
import { fetchWithRetry } from '@/lib/fetch';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const DEFAULT_TTS_MODEL = 'XiaomiMiMo/MiMo-V2.5-tts';
const VOICE_CLONE_MODEL = 'XiaomiMiMo/MiMo-V2.5-tts-voiceclone';
const DEFAULT_VOICE_ID = 'mimo_default';
const STYLE_PROMPT =
  'High-confidence, eloquent public speaking: brilliant, composed, persuasive, warm, crystal-clear articulation, measured pauses, strong audience command, polished cadence, and an inspiring keynote-level delivery.';

type AudioMode = 'example' | 'clone';

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
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).msg : null))
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
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
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
      const audioRes = await fetchWithRetry(payload, { signal: AbortSignal.timeout(60000) }, 1);
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
  const res = await fetchWithRetry(`https://api.deepinfra.com/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=opus`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: 'opus',
      language_code: 'en',
      style_prompt: STYLE_PROMPT,
      instructions: STYLE_PROMPT,
    }),
  }, 1);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(providerMessage(data) || 'Speech audio generation failed.');
  }

  return readAudioResponse(res);
}

async function synthesizeDirect(modelId: string, text: string, token: string, sample?: File) {
  const isClone = Boolean(sample);
  const body = isClone ? new FormData() : JSON.stringify({
    text,
    prompt: STYLE_PROMPT,
    style_prompt: STYLE_PROMPT,
    instructions: STYLE_PROMPT,
    response_format: 'opus',
    output_format: 'opus',
    format: 'opus',
  });

  if (body instanceof FormData && sample) {
    body.append('text', text);
    body.append('prompt', STYLE_PROMPT);
    body.append('style_prompt', STYLE_PROMPT);
    body.append('instructions', STYLE_PROMPT);
    body.append('response_format', 'opus');
    body.append('output_format', 'opus');
    body.append('format', 'opus');
    body.append('file', sample, sample.name || 'voice-sample.webm');
    body.append('audio', sample, sample.name || 'voice-sample.webm');
    body.append('reference_audio', sample, sample.name || 'voice-sample.webm');
    body.append('prompt_audio', sample, sample.name || 'voice-sample.webm');
  }

  const res = await fetchWithRetry(`https://api.deepinfra.com/v1/inference/${modelId}`, {
    method: 'POST',
    headers: body instanceof FormData
      ? { Authorization: `Bearer ${token}` }
      : {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
    signal: AbortSignal.timeout(120000),
    body,
  }, 1);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(providerMessage(data) || 'Speech audio generation failed.');
  }

  return readAudioResponse(res);
}

async function createVoice(sample: File, userId: string, token: string) {
  const voiceForm = new FormData();
  voiceForm.append('name', `Aawaz voice ${userId.slice(0, 18) || Date.now()}`);
  voiceForm.append('description', 'Short voice sample captured after speech analysis for practice speech playback.');
  voiceForm.append('files', sample, sample.name || 'voice-sample.webm');

  const res = await fetchWithRetry('https://api.deepinfra.com/v1/voices/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120000),
    body: voiceForm,
  }, 1);

  const data = await res.json().catch(() => ({}));
  const voiceId = typeof data?.voice_id === 'string' ? data.voice_id : '';

  if (!res.ok || !voiceId) {
    throw new Error(providerMessage(data) || 'Could not create a cloned voice from the saved speech sample.');
  }

  return voiceId;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const mode = String(form.get('mode') || 'example') as AudioMode;
    const text = cleanText(form.get('text'));
    const userId = cleanText(form.get('userId')).slice(0, 128);

    if (mode !== 'example' && mode !== 'clone') {
      return Response.json({ error: 'Invalid speech audio mode.' }, { status: 400 });
    }

    if (!text) {
      return Response.json({ error: 'First generate a text script.' }, { status: 400 });
    }

    const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
    if (!DEEPINFRA_API_KEY) {
      return Response.json({ error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    const rateKey = `generate-speech-audio:${mode}:${getClientKey(req, userId)}`;
    const rateLimit = checkRateLimit(rateKey, 8, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many voice generation requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    let result: Awaited<ReturnType<typeof readAudioResponse>>;

    if (mode === 'clone') {
      if (!userId) {
        return Response.json({ error: 'User identity is missing. Refresh the page and try again.' }, { status: 400 });
      }

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

      try {
        const voiceId = await createVoice(sample, userId, DEEPINFRA_API_KEY);
        result = await synthesizeWithVoice(voiceId, text, VOICE_CLONE_MODEL, DEEPINFRA_API_KEY);
      } catch {
        result = await synthesizeDirect(VOICE_CLONE_MODEL, text, DEEPINFRA_API_KEY, sample);
      }
    } else {
      try {
        result = await synthesizeWithVoice(DEFAULT_VOICE_ID, text, DEFAULT_TTS_MODEL, DEEPINFRA_API_KEY);
      } catch {
        result = await synthesizeDirect(DEFAULT_TTS_MODEL, text, DEEPINFRA_API_KEY);
      }
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
    return Response.json(
      { error: error instanceof Error ? error.message : 'Speech audio generation failed. Please try again.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
