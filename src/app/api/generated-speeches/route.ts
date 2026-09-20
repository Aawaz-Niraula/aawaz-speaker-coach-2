import { NextRequest } from 'next/server';

import { IdentityError, resolveAppUser } from '@/lib/app-user';
import { isSafeId, readJsonObject } from '@/lib/body';
import { deleteGeneratedSpeechAndList, listGeneratedSpeeches } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';
import { enforceRateLimit } from '@/lib/rate-limit';

/** Scripts written in Speech Practice, for the history tab's second view. */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await resolveAppUser(req, false);

    const limited = enforceRateLimit(req, userId, { name: 'scripts:get', limit: 120, windowMs: 60 * 1000 });
    if (limited) return limited;

    const speeches = await listGeneratedSpeeches(userId);
    return Response.json({ speeches });
  } catch (error) {
    if (error instanceof IdentityError) {
      // First visit before the guest cookie exists: nothing saved yet.
      return Response.json({ speeches: [] });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { body, response } = await readJsonObject(req);
  if (response) return response;

  const speechId = body.speechId;
  if (!isSafeId(speechId)) {
    return Response.json({ ok: false, error: 'Missing speechId.' }, { status: 400 });
  }

  try {
    const { userId } = await resolveAppUser(req, false);

    const limited = enforceRateLimit(req, userId, { name: 'scripts:delete', limit: 60, windowMs: 15 * 60 * 1000 });
    if (limited) return limited;

    // The delete and the refreshed list travel in one round trip.
    const { deleted, speeches } = await deleteGeneratedSpeechAndList(userId, speechId);

    if (!deleted) {
      return Response.json({ ok: false, error: 'Speech not found.' }, { status: 404 });
    }

    return Response.json({ ok: true, speeches });
  } catch (error) {
    if (error instanceof IdentityError) {
      return Response.json({ ok: false, error: 'Session expired.' }, { status: 401 });
    }
    throw error;
  }
}

export const runtime = 'nodejs';
