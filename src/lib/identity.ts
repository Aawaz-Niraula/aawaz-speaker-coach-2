import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { getTrustedOrigins } from '@/lib/origins';

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

let warnedAboutDevSecret = false;

/**
 * The HMAC key for guest cookies.
 *
 * In production there is no fallback: a guessable key would let anyone forge
 * guest identities and walk straight past the free-use limit. Returning null
 * makes every guest path fail closed until the secret is configured. Only a
 * development build gets a fixed key, so the app runs without a .env file.
 */
function getGuestSecret(): string | null {
  const configured = process.env.AAWAZ_GUEST_SECRET || process.env.BETTER_AUTH_SECRET;
  if (configured) return configured;

  if (process.env.NODE_ENV !== 'production') {
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn('[identity] No AAWAZ_GUEST_SECRET or BETTER_AUTH_SECRET set; using a development-only guest signing key.');
    }
    return 'aawaz-development-only-guest-secret';
  }

  return null;
}

export function isGuestIdentityConfigured() {
  return getGuestSecret() !== null;
}

function signGuestId(guestId: string, secret: string) {
  return createHmac('sha256', secret).update(guestId).digest('base64url');
}

export function createGuestIdentity() {
  const secret = getGuestSecret();
  if (!secret) return null;

  const guestId = `${GUEST_ID_PREFIX}${randomUUID()}`;
  return { guestId, token: `${guestId}.${signGuestId(guestId, secret)}` };
}

export function verifyGuestToken(token: string | null | undefined) {
  if (!token || token.length > 256) return null;

  const secret = getGuestSecret();
  if (!secret) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const guestId = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!guestId.startsWith(GUEST_ID_PREFIX) || guestId.length > 80) return null;

  const expected = Buffer.from(signGuestId(guestId, secret));
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
  if (process.env.NODE_ENV === 'production') return true;
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
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
  const fetchSite = req.headers.get('sec-fetch-site');
  // Opaque origins (sandboxed frames, for example) are not a missing header.
  if (origin !== 'null' && fetchSite !== 'cross-site' && fetchSite !== 'same-site') {
    if (!origin) return null; // non-browser clients / same-origin requests
    try {
      const allowed = getTrustedOrigins();
      // A configured production deployment uses only its explicit origins.
      // Local servers can use their request URL; never trust x-forwarded-host.
      if (process.env.NODE_ENV !== 'production' || allowed.length === 0) {
        allowed.push(new URL(req.url).origin);
      }
      if (new URL(origin).origin === origin && allowed.includes(origin)) return null;
    } catch {
      // fall through to rejection
    }
  }

  return Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
}
