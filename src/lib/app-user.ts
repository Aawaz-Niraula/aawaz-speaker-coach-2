import { auth } from '@/lib/auth';
import { consumeDailyQuota, consumeGuestUsage, ensureSchema } from '@/lib/db';
import { readVerifiedGuestId } from '@/lib/identity';
import { getClientIp } from '@/lib/rate-limit';

export { QuotaUnavailableError } from '@/lib/db';

export function quotaUnavailableResponse() {
  return Response.json(
    { error: 'Usage protection is temporarily unavailable. Please try again shortly.' },
    { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
  );
}

const GUEST_LIMIT_MESSAGE = 'Create a free account to keep using Aawaz Speaker Coach.';
const IDENTITY_MESSAGE = 'Your session could not be verified. Refresh the page and try again.';

export class GuestLimitError extends Error {
  status = 403;
  remaining = 0;

  constructor() {
    super(GUEST_LIMIT_MESSAGE);
  }
}

export class IdentityError extends Error {
  status = 401;

  constructor() {
    super(IDENTITY_MESSAGE);
  }
}

const QUOTA_MESSAGE = 'You have reached today\'s limit for this feature. It resets tomorrow.';

/** Thrown when a signed-in user exhausts their daily allowance for a route. */
export class DailyQuotaError extends Error {
  status = 429;

  constructor() {
    super(QUOTA_MESSAGE);
  }
}

export function dailyQuotaResponse() {
  return Response.json(
    { error: QUOTA_MESSAGE, quotaExceeded: true },
    { status: 429 },
  );
}

export type AppIdentity = {
  userId: string;
  isGuest: boolean;
};

export type ResolvedAppUser = AppIdentity & {
  guestRemaining: number | null;
};

/**
 * Who is calling, from server-side state only:
 * - a Better Auth session cookie for signed-in users, or
 * - the signed, httpOnly guest cookie for guests.
 *
 * Client-provided user ids are never trusted. This reads but never writes,
 * so a route can learn the identity, run its in-memory rate limits, and
 * only then pay for a database write with consumeUsage(). Under a flood the
 * cheap rejections happen before the database sees anything.
 */
export async function resolveIdentity(req: Request): Promise<AppIdentity> {
  await ensureSchema();
  const session = await auth.api.getSession({ headers: req.headers }).catch((err) => {
    console.error('getSession failed:', err);
    return null;
  });
  const authUserId = session?.user?.id;

  if (authUserId) {
    return { userId: authUserId, isGuest: false };
  }

  const guestId = readVerifiedGuestId(req);
  if (!guestId) {
    throw new IdentityError();
  }

  return { userId: guestId, isGuest: true };
}

/**
 * Charges one use of an expensive route to the caller.
 *
 * Signed-in users draw on a daily quota per route. Guests draw on their
 * cookie's small allowance and on a per-address daily cap, checked in that
 * order of cost: the address cap first, so a blocked address does not spend
 * one of the guest's three uses for nothing.
 *
 * Call this after the in-memory rate limits have passed, never before.
 */
export async function consumeUsage(
  req: Request,
  identity: AppIdentity,
  /** Route name for the daily quota, e.g. 'transcribe-analyze'. */
  action: string,
): Promise<ResolvedAppUser> {
  if (!identity.isGuest) {
    const quota = await consumeDailyQuota(identity.userId, action);
    if (!quota.allowed) throw new DailyQuotaError();

    return { ...identity, guestRemaining: null };
  }

  const addressQuota = await consumeDailyQuota(`ip:${getClientIp(req)}`, 'guest-actions');
  if (!addressQuota.allowed) {
    throw new GuestLimitError();
  }

  const usage = await consumeGuestUsage(identity.userId);
  if (!usage.allowed) {
    throw new GuestLimitError();
  }

  return { ...identity, guestRemaining: usage.remaining };
}

/**
 * Identity and, optionally, a usage charge in one call.
 *
 * The read-only routes use this with consumeGuestUse=false. The expensive
 * routes call resolveIdentity() and consumeUsage() separately so their rate
 * limits sit between the two.
 */
export async function resolveAppUser(
  req: Request,
  consumeGuestUse = false,
  action?: string,
): Promise<ResolvedAppUser> {
  const identity = await resolveIdentity(req);

  if (consumeGuestUse && action) {
    return consumeUsage(req, identity, action);
  }

  return { ...identity, guestRemaining: null };
}

export function guestLimitResponse() {
  return Response.json(
    { error: GUEST_LIMIT_MESSAGE, authRequired: true },
    { status: 403 },
  );
}

export function identityErrorResponse() {
  return Response.json(
    { error: IDENTITY_MESSAGE, identityRequired: true },
    { status: 401 },
  );
}
