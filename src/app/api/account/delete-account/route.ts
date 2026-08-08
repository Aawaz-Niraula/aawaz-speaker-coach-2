import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureAuthSchema, ensureSpeechSchema } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const speechDb = await ensureSpeechSchema();
  const authDb = await ensureAuthSchema();

  if (!speechDb || !authDb) {
    return Response.json({ error: 'Database unavailable. Account was not deleted.' }, { status: 503 });
  }

  // Delete speech data first, then the auth user. If any step fails we report
  // failure instead of pretending the account is gone.
  try {
    await speechDb.execute({ sql: 'DELETE FROM speech_sessions WHERE user_id = ?', args: [userId] });
    // The voice-sample feature is gone, but old rows may still exist on
    // databases created before it was removed. Ignore a missing table.
    await speechDb
      .execute({ sql: 'DELETE FROM speech_voice_samples WHERE user_id = ?', args: [userId] })
      .catch(() => null);
  } catch (error) {
    console.error('Failed to delete speech data during account deletion', error);
    return Response.json(
      { error: 'Your speech data could not be fully deleted. Account was not deleted — please try again.' },
      { status: 500 },
    );
  }

  try {
    // session and account declare ON DELETE CASCADE, but SQLite only honours
    // that when PRAGMA foreign_keys is ON. Delete the children explicitly so
    // credentials and OAuth tokens can never outlive the account, whatever the
    // connection default happens to be.
    await authDb.execute({ sql: 'DELETE FROM session WHERE userId = ?', args: [userId] });
    await authDb.execute({ sql: 'DELETE FROM account WHERE userId = ?', args: [userId] });
    // verification rows are keyed by email/identifier, not userId, so they are
    // never reached by the cascade.
    if (session.user.email) {
      await authDb.execute({ sql: 'DELETE FROM verification WHERE identifier = ?', args: [session.user.email] });
    }
    await authDb.execute({ sql: 'DELETE FROM user WHERE id = ?', args: [userId] });
  } catch (error) {
    console.error('Failed to delete user from auth db', error);
    return Response.json(
      { error: 'Your speech data was removed, but the account record could not be deleted. Please try again.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}

export const runtime = 'nodejs';
