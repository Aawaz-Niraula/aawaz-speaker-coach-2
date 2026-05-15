import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';
import { ensureAuthSchema } from '@/lib/db';

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureAuthSchema();
  return handlers.GET(req);
}

export async function POST(req: Request) {
  await ensureAuthSchema();
  return handlers.POST(req);
}

export const runtime = 'nodejs';
