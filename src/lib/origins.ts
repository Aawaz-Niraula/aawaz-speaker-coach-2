/** Deployment configuration, never caller-supplied forwarding headers. */
export function getTrustedOrigins() {
  const origins = new Set<string>();
  for (const value of [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.AAWAZ_TRUSTED_ORIGINS || '').split(','),
  ]) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
      if (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
        origins.add(url.origin);
      }
    } catch {
      // Invalid configuration never becomes an approved origin.
    }
  }
  if (process.env.NODE_ENV === 'development') origins.add('http://localhost:3000');
  return [...origins];
}
