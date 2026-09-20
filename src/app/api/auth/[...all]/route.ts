import { toNextJsHandler } from 'better-auth/next-js';

import { normalizeAccountEmail } from '@/lib/account-validation';
import { auth } from '@/lib/auth';
import { readBoundedRequest } from '@/lib/body';
import { consumeDurableRateLimit, ensureSchema, resetDurableRateLimit } from '@/lib/db';
import { clearRateLimit, enforceIpRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { requireSameOrigin } from '@/lib/identity';

let _handlers: ReturnType<typeof toNextJsHandler> | undefined;

function getHandlers() {
  if (!_handlers) {
    _handlers = toNextJsHandler({
      handler: (req) => auth.handler(req),
    });
  }
  return _handlers;
}

function hasCoreAuthConfig() {
  return Boolean(
    process.env.BETTER_AUTH_SECRET
    && process.env.TURSO_DATABASE_URL
    && process.env.TURSO_AUTH_TOKEN,
  );
}

function missingAuthConfigResponse() {
  return Response.json(
    { error: 'Account features need auth and database environment variables to be configured.' },
    { status: 503 },
  );
}

function authSetupErrorResponse(error: unknown) {
  console.error('Better Auth request failed:', error);
  return Response.json(
    { error: 'Account sign-in could not start because the auth database adapter failed to initialize.' },
    { status: 503 },
  );
}

/** Auth bodies are an email, a password and a name; nothing near this. */
const MAX_AUTH_BODY_BYTES = 16 * 1024;

/*
 * Login throttling.
 *
 * Five attempts per fifteen minutes, counted two ways:
 *  - per address, every attempt on the credential routes, successful or not;
 *  - per account (email), failed attempts only, cleared by a success.
 *
 * The first is what the spec asks for. The second is what actually protects
 * an account from a guess spread across many addresses. Both live in the
 * database so the count holds across every server instance. An unavailable
 * counter stops credential attempts until protection is restored. Any
 * other auth POST gets a looser per-address ceiling.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const CREDENTIAL_PATHS = new Set(['/sign-in/email', '/sign-up/email']);
const LOGIN_MESSAGE = 'Too many sign-in attempts. Please wait 15 minutes and try again.';

function authPath(req: Request) {
  return new URL(req.url).pathname.replace(/^\/api\/auth/, '').replace(/\/+$/, '') || '/';
}

async function limitAttempts(key: string) {
  return consumeDurableRateLimit(key, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
}

async function forgetAttempts(key: string) {
  clearRateLimit(key);
  await resetDurableRateLimit(key);
}

async function readEmail(req: Request) {
  try {
    const body = await req.clone().json() as { email?: unknown } | null;
    return typeof body?.email === 'string' ? normalizeAccountEmail(body.email).slice(0, 254) : '';
  } catch {
    return '';
  }
}

export async function GET(req: Request) {
  const path = authPath(req);
  if (!hasCoreAuthConfig()) {
    if (path.endsWith('/get-session')) {
      return Response.json(null);
    }
    return missingAuthConfigResponse();
  }

  // get-session is polled by every open tab, so this is deliberately loose;
  // it exists to stop a scripted client, not to meter real use.
  const limited = enforceIpRateLimit(req, { name: 'auth:get', limit: 300, windowMs: 60 * 1000 });
  if (limited) return limited;

  await ensureSchema();
  try {
    return await getHandlers().GET(req);
  } catch (error) {
    if (path.endsWith('/get-session')) {
      console.error('Better Auth session request failed:', error);
      return Response.json(null);
    }
    return authSetupErrorResponse(error);
  }
}

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  if (!hasCoreAuthConfig()) {
    return missingAuthConfigResponse();
  }

  const bounded = await readBoundedRequest(req, MAX_AUTH_BODY_BYTES);
  if (bounded.response) return bounded.response;
  req = bounded.request;

  const path = authPath(req);
  const ip = getClientIp(req);

  // The limiter and auth handler must parse exactly the same credential body.
  // Reject ambiguous media types instead of skipping the per-email counter.
  if (CREDENTIAL_PATHS.has(path) && req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return Response.json({ error: 'Credentials must be sent as application/json.' }, { status: 415 });
  }

  if (!CREDENTIAL_PATHS.has(path)) {
    const limited = enforceIpRateLimit(req, { name: 'auth:post', limit: 30, windowMs: LOGIN_WINDOW_MS });
    if (limited) return limited;
  } else {
    const addressKey = `auth:${path}:ip:${ip}`;
    const byAddress = await limitAttempts(addressKey);
    if (!byAddress) return Response.json({ error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' }, { status: 503 });
    if (!byAddress.allowed) return rateLimitResponse(byAddress.retryAfterSeconds, LOGIN_MESSAGE);

    const email = await readEmail(req);
    const accountKey = email ? `auth:${path}:email:${email}` : null;
    if (accountKey) {
      const byAccount = await limitAttempts(accountKey);
      if (!byAccount) return Response.json({ error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' }, { status: 503 });
      if (!byAccount.allowed) return rateLimitResponse(byAccount.retryAfterSeconds, LOGIN_MESSAGE);
    }

    await ensureSchema();
    try {
      const res = await getHandlers().POST(req);
      if (res.ok && accountKey) await forgetAttempts(accountKey);
      return res;
    } catch (error) {
      return authSetupErrorResponse(error);
    }
  }

  await ensureSchema();
  try {
    return await getHandlers().POST(req);
  } catch (error) {
    return authSetupErrorResponse(error);
  }
}

export const runtime = 'nodejs';
