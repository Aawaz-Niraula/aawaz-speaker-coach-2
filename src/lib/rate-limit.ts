type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function cleanupBuckets(now: number) {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

/**
 * Best-effort client address.
 *
 * Vercel (and any sane reverse proxy) overwrites x-forwarded-for with the
 * real client address, so the first entry is trustworthy there. Behind no
 * proxy at all the header is client-controlled, which is why every limit
 * keyed on it is backed by a per-identity or global ceiling as well.
 */
export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();

  return (forwardedFor || realIp || 'unknown-ip').slice(0, 64);
}

export function getClientKey(req: Request, fallback: string) {
  const userKey = fallback || 'anonymous';

  return `${userKey}:${getClientIp(req)}`;
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  cleanupBuckets(now);

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Forgets a key, e.g. an account's failed-login counter after a success. */
export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export type RateRule = {
  /** Namespace for the bucket, usually the route name. */
  name: string;
  limit: number;
  windowMs: number;
  /** User-facing text for the 429 body. */
  message?: string;
};

const DEFAULT_MESSAGE = 'Too many requests. Please wait a moment and try again.';

export function rateLimitResponse(retryAfterSeconds: number, message = DEFAULT_MESSAGE) {
  return Response.json(
    { error: message, rateLimited: true },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfterSeconds)),
        'Cache-Control': 'no-store',
      },
    },
  );
}

/**
 * Per-identity limit (identity + address), in process memory.
 *
 * Returns a ready 429 response when the caller is over the limit, or null to
 * let the request through. Memory is per server instance, so this is burst
 * protection; the durable ceilings live in the database.
 */
export function enforceRateLimit(req: Request, identity: string, rule: RateRule): Response | null {
  const result = checkRateLimit(`${rule.name}:${getClientKey(req, identity)}`, rule.limit, rule.windowMs);
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds, rule.message);
}

/**
 * Address-only limit for routes that run before any identity exists, or
 * where an identity is free to mint (a guest can always drop its cookie).
 */
export function enforceIpRateLimit(req: Request, rule: RateRule): Response | null {
  const result = checkRateLimit(`${rule.name}:ip:${getClientIp(req)}`, rule.limit, rule.windowMs);
  return result.allowed ? null : rateLimitResponse(result.retryAfterSeconds, rule.message);
}
