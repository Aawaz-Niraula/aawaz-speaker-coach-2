import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { deleteUserAccount, ensureSchema } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = enforceRateLimit(req, session.user.id, { name: 'account:delete-account', limit: 5, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  if (!(await ensureSchema())) {
    return Response.json({ error: 'Database unavailable. Account was not deleted.' }, { status: 503 });
  }

  // One transaction covers the speech data, the sessions, the credentials
  // and the user row. It either all goes or none of it does, so we never
  // report an account gone that is still half there.
  try {
    await deleteUserAccount(session.user.id, session.user.email);
  } catch (error) {
    console.error('Failed to delete account', error);
    return Response.json(
      { error: 'Your account could not be deleted. Nothing was removed. Please try again.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}

export const runtime = 'nodejs';
