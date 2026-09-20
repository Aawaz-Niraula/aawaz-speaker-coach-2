import { NextRequest } from 'next/server';

import { IdentityError, resolveAppUser } from '@/lib/app-user';
import { isSafeId, readJsonObject } from '@/lib/body';
import { deleteSpeechSessionAndList, listRecentSpeechSessions } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await resolveAppUser(req, false);

    const limited = enforceRateLimit(req, userId, { name: 'history:get', limit: 120, windowMs: 60 * 1000 });
    if (limited) return limited;

    const history = await listRecentSpeechSessions(userId);
    return Response.json({ history });
  } catch (error) {
    if (error instanceof IdentityError) {
      // First visit before the guest cookie exists: nothing saved yet.
      return Response.json({ history: [] });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const { body, response } = await readJsonObject(req);
  if (response) return response;

  const sessionId = body.sessionId;
  if (!isSafeId(sessionId)) {
    return Response.json({ ok: false, error: 'Missing sessionId.' }, { status: 400 });
  }

  let userId: string;
  try {
    ({ userId } = await resolveAppUser(req, false));
  } catch (error) {
    if (error instanceof IdentityError) {
      return Response.json({ ok: false, error: error.message }, { status: 401 });
    }
    throw error;
  }

  const limited = enforceRateLimit(req, userId, { name: 'history:delete', limit: 60, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  // The delete and the refreshed list travel in one round trip.
  const { deleted, history } = await deleteSpeechSessionAndList(userId, sessionId);

  if (!deleted) {
    return Response.json({ ok: false, error: 'Could not delete session.', history }, { status: 404 });
  }

  return Response.json({ ok: true, history });
}

export const runtime = 'nodejs';
