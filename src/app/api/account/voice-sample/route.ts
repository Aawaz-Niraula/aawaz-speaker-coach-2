import { NextRequest } from 'next/server';

import { GuestLimitError, guestLimitResponse, resolveAppUser } from '@/lib/app-user';
import { deleteSpeechVoiceSample, replaceSpeechVoiceSample } from '@/lib/db';

function cleanUserId(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim().slice(0, 128) : '';
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providedUserId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 128) : '';
    const { userId } = await resolveAppUser(req, providedUserId, false);
    const deleted = await deleteSpeechVoiceSample(userId);

    if (!deleted) {
      return Response.json({ error: 'Could not delete the saved voice sample.' }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not delete the saved voice sample.' },
      { status: 503 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const providedUserId = cleanUserId(form.get('userId'));
    const voiceSample = form.get('voiceSample') as File | null;

    if (!voiceSample || voiceSample.size < 3000) {
      return Response.json({ error: 'No usable voice sample was recorded.' }, { status: 400 });
    }

    if (voiceSample.size > 8 * 1024 * 1024) {
      return Response.json({ error: 'Voice sample is too large. Please record again.' }, { status: 413 });
    }

    const { userId } = await resolveAppUser(req, providedUserId, false);
    const saved = await replaceSpeechVoiceSample({
      userId,
      audioData: await voiceSample.arrayBuffer(),
      mimeType: voiceSample.type || 'audio/webm;codecs=opus',
      filename: voiceSample.name || 'voice-sample.webm',
    });

    if (!saved) {
      return Response.json({ error: 'Could not save the new voice sample.' }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not save the new voice sample.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
