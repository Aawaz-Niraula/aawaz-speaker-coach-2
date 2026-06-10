import { auth } from '@/lib/auth';
import { consumeGuestUsage, ensureAuthSchema } from '@/lib/db';
import { readVerifiedGuestId } from '@/lib/identity';

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

export type ResolvedAppUser = {
  userId: string;
  isGuest: boolean;
  guestRemaining: number | null;
};

/**
 * Resolves the caller's identity from server-side state only:
 * - a Better Auth session cookie for signed-in users, or
 * - the signed, httpOnly guest cookie for guests.
 *
 * Client-provided user ids are never trusted.
 */
export async function resolveAppUser(req: Request, consumeGuestUse = false): Promise<ResolvedAppUser> {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers }).catch((err) => {
    console.error('getSession failed:', err);
    return null;
  });
  const authUserId = session?.user?.id;

  if (authUserId) {
    return {
      userId: authUserId,
      isGuest: false,
      guestRemaining: null,
    };
  }

  const guestId = readVerifiedGuestId(req);
  if (!guestId) {
    throw new IdentityError();
  }

  if (!consumeGuestUse) {
    return {
      userId: guestId,
      isGuest: true,
      guestRemaining: null,
    };
  }

  const usage = await consumeGuestUsage(guestId);
  if (!usage.allowed) {
    throw new GuestLimitError();
  }

  return {
    userId: guestId,
    isGuest: true,
    guestRemaining: usage.remaining,
  };
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
