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

export async function GET(req: Request) {
  if (!hasCoreAuthConfig()) {
    const path = new URL(req.url).pathname;
    if (path.endsWith('/get-session')) {
      return Response.json(null);
    }
    return missingAuthConfigResponse();
  }

  await ensureAuthSchema();
  return getHandlers().GET(req);
}

export async function POST(req: Request) {
  if (!hasCoreAuthConfig()) {
    return missingAuthConfigResponse();
  }

  await ensureAuthSchema();
  return getHandlers().POST(req);
}

export const runtime = 'nodejs';
