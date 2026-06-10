import { NextRequest } from 'next/server';

import { IdentityError, resolveAppUser } from '@/lib/app-user';
import { deleteSpeechSession, listRecentSpeechSessions } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await resolveAppUser(req, false);
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

  const body = await req.json().catch(() => null) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim().slice(0, 128) : '';

  if (!sessionId) {
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

  const deleted = await deleteSpeechSession(userId, sessionId);
  const history = await listRecentSpeechSessions(userId);

  if (!deleted) {
    return Response.json({ ok: false, error: 'Could not delete session.', history }, { status: 404 });
  }

  return Response.json({ ok: true, history });
}

export const runtime = 'nodejs';
