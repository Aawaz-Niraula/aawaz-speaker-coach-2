import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { deleteUserSpeechData, ensureSchema } from '@/lib/db';
import { requireSameOrigin } from '@/lib/identity';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function DELETE(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = enforceRateLimit(req, session.user.id, { name: 'account:delete-data', limit: 5, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  if (!(await ensureSchema())) {
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await deleteUserSpeechData(session.user.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete user data', error);
    return Response.json({ error: 'Your data could not be deleted. Nothing was removed. Please try again.' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
