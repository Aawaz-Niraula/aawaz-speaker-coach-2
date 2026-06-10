import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

/**
 * Server-issued guest identity.
 *
 * Guests are identified by a signed, httpOnly cookie. The cookie value is
 * `<guestId>.<hmac>` where the HMAC is computed server-side, so clients
 * cannot mint or spoof guest identities. The raw guest id is never accepted
 * from request bodies or query strings.
 */

export const GUEST_COOKIE_NAME = 'aawaz_guest';
const GUEST_ID_PREFIX = 'guest_';
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getGuestSecret() {
  return (
    process.env.AAWAZ_GUEST_SECRET
    || process.env.BETTER_AUTH_SECRET
    // Dev-only fallback so the app still works without env configuration.
    || 'aawaz-insecure-dev-secret'
  );
}

function signGuestId(guestId: string) {
  return createHmac('sha256', getGuestSecret()).update(guestId).digest('base64url');
}

export function createGuestIdentity() {
  const guestId = `${GUEST_ID_PREFIX}${randomUUID()}`;
  return { guestId, token: `${guestId}.${signGuestId(guestId)}` };
}

export function verifyGuestToken(token: string | null | undefined) {
  if (!token || token.length > 256) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const guestId = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!guestId.startsWith(GUEST_ID_PREFIX) || guestId.length > 80) return null;

  const expected = Buffer.from(signGuestId(guestId));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  return guestId;
}

function readCookieValue(req: Request, name: string) {
  const header = req.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }

  return null;
}

export function readVerifiedGuestId(req: Request) {
  return verifyGuestToken(readCookieValue(req, GUEST_COOKIE_NAME));
}

function isSecureRequest(req: Request) {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0]?.trim() === 'https';
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function buildGuestCookie(req: Request, token: string) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  return `${GUEST_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_COOKIE_MAX_AGE}${secure}`;
}

export function clearGuestCookie(req: Request) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  return `${GUEST_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Lightweight CSRF protection for cookie-authenticated mutating routes.
 * Browsers always attach an Origin header to cross-site POST/DELETE requests,
 * so a mismatched Origin means the request did not come from our own pages.
 */
export function requireSameOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') {
    // Same-origin non-CORS requests may omit Origin; non-browser clients
    // cannot ride a victim's cookies anyway.
    return null;
  }

  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || req.headers.get('host')
    || '';

  try {
    if (new URL(origin).host === host) {
      return null;
    }
  } catch {
    // fall through to rejection
  }

  return Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
}
