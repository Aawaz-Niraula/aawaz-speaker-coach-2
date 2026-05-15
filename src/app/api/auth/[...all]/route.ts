import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';
import { ensureAuthSchema } from '@/lib/db';

let _handlers: ReturnType<typeof toNextJsHandler> | undefined;

function getHandlers() {
  if (!_handlers) {
    _handlers = toNextJsHandler(auth);
  }
  return _handlers;
}

export async function GET(req: Request) {
  await ensureAuthSchema();
  return getHandlers().GET(req);
}

export async function POST(req: Request) {
  await ensureAuthSchema();
  return getHandlers().POST(req);
}

export const runtime = 'nodejs';
