export async function GET() {
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
    ? 'Account sign-in needs BETTER_AUTH_SECRET, TURSO_DATABASE_URL, and TURSO_AUTH_TOKEN configured.'
    : !hasGoogleConfig
      ? 'Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured.'
      : null;

  return Response.json({
    accountAuthEnabled,
    googleEnabled,
    message,
  });
}

export const runtime = 'nodejs';
