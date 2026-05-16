import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';
import { ensureAuthSchema } from '@/lib/db';

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

export async function GET(req: Request) {
  const path = new URL(req.url).pathname;
  if (!hasCoreAuthConfig()) {
    if (path.endsWith('/get-session')) {
      return Response.json(null);
    }
    return missingAuthConfigResponse();
  }

  await ensureAuthSchema();
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
  if (!hasCoreAuthConfig()) {
    return missingAuthConfigResponse();
  }

  await ensureAuthSchema();
  try {
    return await getHandlers().POST(req);
  } catch (error) {
    return authSetupErrorResponse(error);
  }
}

export const runtime = 'nodejs';
