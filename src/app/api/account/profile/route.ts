import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { ensureAuthSchema } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await ensureAuthSchema();
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
