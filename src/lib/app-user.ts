import { auth } from '@/lib/auth';
import { consumeGuestUsage, ensureAuthSchema } from '@/lib/db';

const GUEST_LIMIT_MESSAGE = 'Create a free account to keep using Aawaz Speaker Coach.';

export class GuestLimitError extends Error {
  status = 403;
  remaining = 0;

  constructor() {
    super(GUEST_LIMIT_MESSAGE);
  }
}

function cleanGuestId(value: string) {
  return value.trim().slice(0, 128);
}

export async function resolveAppUser(req: Request, providedUserId: string, consumeGuestUse = false) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: req.headers });
  const authUserId = session?.user?.id;

  if (authUserId) {
    return {
      userId: authUserId,
      isGuest: false,
      guestRemaining: null as number | null,
    };
  }

  const guestId = cleanGuestId(providedUserId);
  if (!guestId) {
    throw new Error('User identity is missing. Refresh the page and try again.');
  }

  if (!consumeGuestUse) {
    return {
      userId: guestId,
      isGuest: true,
      guestRemaining: null as number | null,
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
