import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGuestCookie, createGuestIdentity, requireSameOrigin, verifyGuestToken } from './identity';

afterEach(() => vi.unstubAllEnvs());

describe('request origin boundary', () => {
  const request = (headers: Record<string, string>) => new Request('https://coach.test/api/generate-speech', {
    method: 'POST', headers: { host: 'coach.test', ...headers },
  });

  it('allows the exact origin', () => {
    expect(requireSameOrigin(request({ origin: 'https://coach.test' }))).toBeNull();
  });

  it.each(['null', 'http://coach.test', 'https://evil.test', 'https://coach.test.evil.test'])('rejects origin %s', (origin) => {
    expect(requireSameOrigin(request({ origin }))?.status).toBe(403);
  });

  it('does not let a forwarded-host header approve an attacker origin', () => {
    expect(requireSameOrigin(request({ origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' }))?.status).toBe(403);
  });

  it('rejects browser cross-site requests even without Origin', () => {
    expect(requireSameOrigin(request({ 'sec-fetch-site': 'cross-site' }))?.status).toBe(403);
  });

  it('still permits non-browser requests without origin metadata', () => {
    expect(requireSameOrigin(request({}))).toBeNull();
  });
});

describe('guest cookie integrity', () => {
  it('rejects forged tokens and requires a production signing key', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AAWAZ_GUEST_SECRET', 'test-secret-with-at-least-32-characters');
    const identity = createGuestIdentity()!;
    expect(verifyGuestToken(identity.token)).toBe(identity.guestId);
    expect(verifyGuestToken(identity.token.replace('guest_', 'guest_other'))).toBeNull();
    vi.stubEnv('AAWAZ_GUEST_SECRET', '');
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    expect(createGuestIdentity()).toBeNull();
  });

  it('never downgrades production cookies based on forwarded protocol', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = new Request('https://coach.test', { headers: { 'x-forwarded-proto': 'http' } });
    expect(buildGuestCookie(req, 'token')).toContain('; Secure');
  });
});
