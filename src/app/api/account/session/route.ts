import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureAuthSchema } from '@/lib/db';
import { buildGuestCookie, createGuestIdentity, readVerifiedGuestId } from '@/lib/identity';

/**
 * Identity bootstrap. Signed-in users are recognized via their Better Auth
 * session. Everyone else receives a server-issued, HMAC-signed guest id in
 * an httpOnly cookie. The client never chooses its own identity.
 */
export async function GET(req: NextRequest) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

  if (session?.user?.id) {
    return Response.json({ kind: 'user' });
  }

  const existingGuestId = readVerifiedGuestId(req);
  if (existingGuestId) {
    return Response.json({ kind: 'guest' });
  }

  const { token } = createGuestIdentity();
  return Response.json(
    { kind: 'guest' },
    { headers: { 'Set-Cookie': buildGuestCookie(req, token) } },
  );
}

export const runtime = 'nodejs';
