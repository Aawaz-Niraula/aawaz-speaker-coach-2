import { NextRequest } from 'next/server';

import { listRecentSpeechSessions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return Response.json({ history: [] });
  }

  const history = await listRecentSpeechSessions(userId);
  return Response.json({ history });
}

export const runtime = 'nodejs';
