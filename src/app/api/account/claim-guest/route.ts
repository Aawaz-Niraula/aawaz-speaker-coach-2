import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureAuthSchema, mergeGuestDataIntoUser } from '@/lib/db';

export async function POST(req: NextRequest) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const guestId = typeof body?.guestId === 'string' ? body.guestId.trim().slice(0, 128) : '';

  if (!guestId) {
    return Response.json({ ok: false, error: 'Missing guest id.' }, { status: 400 });
  }

  const merged = await mergeGuestDataIntoUser(guestId, session.user.id);

  return Response.json({ ok: true, merged });
}

export const runtime = 'nodejs';
