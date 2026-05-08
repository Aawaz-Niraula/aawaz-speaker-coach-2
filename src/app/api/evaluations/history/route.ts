import { NextRequest } from 'next/server';

import { deleteSpeechSession, listRecentSpeechSessions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')?.trim().slice(0, 128);

  if (!userId) {
    return Response.json({ history: [] });
  }

  const history = await listRecentSpeechSessions(userId);
  return Response.json({ history });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    userId?: unknown;
    sessionId?: unknown;
  } | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 128) : '';
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim().slice(0, 128) : '';

  if (!userId || !sessionId) {
    return Response.json({ ok: false, error: 'Missing userId or sessionId.' }, { status: 400 });
  }

  const deleted = await deleteSpeechSession(userId, sessionId);
  const history = await listRecentSpeechSessions(userId);

  if (!deleted) {
    return Response.json({ ok: false, error: 'Could not delete session.', history }, { status: 503 });
  }

  return Response.json({ ok: true, history });
}

export const runtime = 'nodejs';
