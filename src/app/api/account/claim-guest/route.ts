import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureSchema, mergeGuestDataIntoUser } from '@/lib/db';
import { clearGuestCookie, readVerifiedGuestId, requireSameOrigin } from '@/lib/identity';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Merges the caller's own guest data into their freshly signed-in account.
 * The guest id comes exclusively from the signed httpOnly cookie, so a user
 * can only ever claim the guest identity their own browser was issued.
 */
export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  await ensureSchema();
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  }

  const limited = enforceRateLimit(req, session.user.id, { name: 'account:claim-guest', limit: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const guestId = readVerifiedGuestId(req);
  if (!guestId) {
    // Nothing to merge: no verifiable guest identity on this browser.
    return Response.json({ ok: true, merged: false });
  }

  const merged = await mergeGuestDataIntoUser(guestId, session.user.id);
  if (!merged) {
    return Response.json({ ok: false, error: 'Guest history could not be attached. Please try again.' }, { status: 503 });
  }

  return Response.json(
    { ok: true, merged },
    // The guest identity has been absorbed; retire the cookie.
    { headers: { 'Set-Cookie': clearGuestCookie(req) } },
  );
}

export const runtime = 'nodejs';
