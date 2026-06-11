import { after, NextRequest } from 'next/server';

import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { deleteSpeechVoiceSample, getSpeechVoiceSampleProviderVoiceId, replaceSpeechVoiceSample } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';
import { deleteProviderVoice } from '@/lib/provider-voice';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

/** Best-effort: free the old DeepInfra voice slot once the request is done. */
function scheduleProviderVoiceCleanup(providerVoiceId: string | null) {
  const token = process.env.DEEPINFRA_API_KEY;
  if (!providerVoiceId || !token) return;

  after(async () => {
    await deleteProviderVoice(providerVoiceId, token);
  });
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof GuestLimitError) {
    return guestLimitResponse();
  }
  if (error instanceof IdentityError) {
    return identityErrorResponse();
  }
  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 503 },
  );
}

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const { userId } = await resolveAppUser(req, false);

    const rateLimit = checkRateLimit(`voice-sample:${getClientKey(req, userId)}`, 20, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many voice sample changes. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    // Deleting the row also clears any stored provider voice id, so a stale
    // cloned voice can never be reused after the sample is replaced.
    const oldProviderVoiceId = await getSpeechVoiceSampleProviderVoiceId(userId);
    const deleted = await deleteSpeechVoiceSample(userId);

    if (!deleted) {
      return Response.json({ error: 'Could not delete the saved voice sample.' }, { status: 503 });
    }

    scheduleProviderVoiceCleanup(oldProviderVoiceId);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Could not delete the saved voice sample.');
  }
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const form = await req.formData();
    const voiceSample = form.get('voiceSample') as File | null;

    if (!voiceSample || voiceSample.size < 3000) {
      return Response.json({ error: 'No usable voice sample was recorded.' }, { status: 400 });
    }

    if (voiceSample.size > 8 * 1024 * 1024) {
      return Response.json({ error: 'Voice sample is too large. Please record again.' }, { status: 413 });
    }

    const { userId } = await resolveAppUser(req, false);

    const rateLimit = checkRateLimit(`voice-sample:${getClientKey(req, userId)}`, 20, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many voice sample changes. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    // Replace = delete old row (and provider voice id) + insert fresh sample.
    const oldProviderVoiceId = await getSpeechVoiceSampleProviderVoiceId(userId);
    const saved = await replaceSpeechVoiceSample({
      userId,
      audioData: await voiceSample.arrayBuffer(),
      mimeType: voiceSample.type || 'audio/webm;codecs=opus',
      filename: voiceSample.name || 'voice-sample.webm',
    });

    if (!saved) {
      return Response.json({ error: 'Could not save the new voice sample.' }, { status: 503 });
    }

    scheduleProviderVoiceCleanup(oldProviderVoiceId);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Could not save the new voice sample.');
  }
}

export const runtime = 'nodejs';
