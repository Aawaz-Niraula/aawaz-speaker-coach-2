import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureSpeechSchema } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const db = await ensureSpeechSchema();
  if (!db) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await db.execute({ sql: 'DELETE FROM speech_sessions WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM speech_voice_samples WHERE user_id = ?', args: [userId] });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete user data', error);
    return Response.json({ error: 'Failed to delete data' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
