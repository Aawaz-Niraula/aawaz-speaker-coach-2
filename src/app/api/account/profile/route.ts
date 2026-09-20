import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureSchema } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = enforceRateLimit(req, session.user.id, { name: 'account:profile', limit: 60, windowMs: 60 * 1000 });
  if (limited) return limited;

  const db = await ensureSchema();
  if (!db) {
    return Response.json({ account: null });
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT providerId, accountId
        FROM account
        WHERE userId = ?
        ORDER BY CASE WHEN providerId = 'google' THEN 0 ELSE 1 END, createdAt DESC
        LIMIT 1
      `,
      args: [session.user.id],
    });

    const account = result.rows[0];
    if (!account) {
      return Response.json({ account: null });
    }

    return Response.json({
      account: {
        providerId: String(account.providerId),
        accountId: String(account.accountId),
      },
    });
  } catch (error) {
    console.error('Failed to load account profile', error);
    return Response.json({ account: null });
  }
}

export const runtime = 'nodejs';
