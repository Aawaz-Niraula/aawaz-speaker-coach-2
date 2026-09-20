import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureSchema } from '@/lib/db';
import { buildGuestCookie, createGuestIdentity, readVerifiedGuestId } from '@/lib/identity';
import { enforceIpRateLimit } from '@/lib/rate-limit';

/**
 * Identity bootstrap. Signed-in users are recognized via their Better Auth
 * session. Everyone else receives a server-issued, HMAC-signed guest id in
 * an httpOnly cookie. The client never chooses its own identity.
 */
export async function GET(req: NextRequest) {
  // Every page load calls this once, so the limit is loose; it exists so a
  // script cannot mint guest identities by the thousand.
  const limited = enforceIpRateLimit(req, { name: 'account:session', limit: 120, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  await ensureSchema();
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

  if (session?.user?.id) {
    return Response.json({ kind: 'user' });
  }

  const existingGuestId = readVerifiedGuestId(req);
  if (existingGuestId) {
    return Response.json({ kind: 'guest' });
  }

  const identity = createGuestIdentity();
  if (!identity) {
    // No signing secret in production: refuse rather than hand out a
    // forgeable identity.
    return Response.json(
      { error: 'Guest access is not configured on this server.' },
      { status: 503 },
    );
  }

  return Response.json(
    { kind: 'guest' },
    { headers: { 'Set-Cookie': buildGuestCookie(req, identity.token) } },
  );
}

export const runtime = 'nodejs';
