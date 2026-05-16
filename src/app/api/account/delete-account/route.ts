import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureSpeechSchema, ensureAuthSchema } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  
  // Delete better-auth user (cascades to session, account, etc)
  try {
    const authDb = await ensureAuthSchema();
    if (authDb) {
      await authDb.execute({ sql: 'DELETE FROM user WHERE id = ?', args: [userId] });
    }
  } catch (error) {
    console.error('Failed to delete user from auth db', error);
  }

  // Delete speech data
  try {
    const db = await ensureSpeechSchema();
    if (db) {
      await db.execute({ sql: 'DELETE FROM speech_sessions WHERE user_id = ?', args: [userId] });
      await db.execute({ sql: 'DELETE FROM speech_voice_samples WHERE user_id = ?', args: [userId] });
    }
  } catch (error) {
    console.error('Failed to delete speech data', error);
  }

  return Response.json({ ok: true });
}

export const runtime = 'nodejs';
