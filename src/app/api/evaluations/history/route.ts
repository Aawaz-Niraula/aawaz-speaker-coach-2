import { NextRequest } from 'next/server';

import { deleteSpeechSession, listRecentSpeechSessions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return Response.json({ history: [] });
  }

  const history = await listRecentSpeechSessions(userId);
  return Response.json({ history });
}

export async function DELETE(req: NextRequest) {
  const { userId, sessionId } = (await req.json()) as {
    userId?: string;
    sessionId?: string;
  };

  if (!userId || !sessionId) {
    return Response.json({ ok: false, error: 'Missing userId or sessionId.' }, { status: 400 });
  }

  await deleteSpeechSession(userId, sessionId);
  const history = await listRecentSpeechSessions(userId);

  return Response.json({ ok: true, history });
}

export const runtime = 'nodejs';
