export async function GET() {
  const accountAuthEnabled = Boolean(
    process.env.BETTER_AUTH_SECRET
    && process.env.TURSO_DATABASE_URL
    && process.env.TURSO_AUTH_TOKEN,
  );
  const googleEnabled = accountAuthEnabled && Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET,
  );

  return Response.json({
    accountAuthEnabled,
    googleEnabled,
  });
}

export const runtime = 'nodejs';
