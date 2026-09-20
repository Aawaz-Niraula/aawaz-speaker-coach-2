import { NextRequest } from 'next/server';

import { enforceIpRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limited = enforceIpRateLimit(req, { name: 'account:auth-status', limit: 120, windowMs: 60 * 1000 });
  if (limited) return limited;

  const hasCoreAuthConfig = Boolean(
    process.env.BETTER_AUTH_SECRET
    && process.env.TURSO_DATABASE_URL
    && process.env.TURSO_AUTH_TOKEN,
  );
  const hasGoogleConfig = Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET,
  );
  const accountAuthEnabled = Boolean(
    hasCoreAuthConfig,
  );
  const googleEnabled = accountAuthEnabled && hasGoogleConfig;
  const message = !hasCoreAuthConfig
    ? 'Account sign-in is not configured on this server.'
    : !hasGoogleConfig
      ? 'Google sign-in is not configured on this server.'
      : null;

  return Response.json({
    accountAuthEnabled,
    googleEnabled,
    message,
  });
}

export const runtime = 'nodejs';
