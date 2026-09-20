import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, InStatement } from '@libsql/client';
import { NextRequest } from 'next/server';

// Exercise real SQL and Better Auth against an isolated in-memory database.
// No .env files, production records or external services are used.
vi.mock('@libsql/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@libsql/client')>();
  return { ...actual, createClient: () => actual.createClient({ url: 'file::memory:' }) };
});

let db: Client;
let store: typeof import('./db');
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('TURSO_DATABASE_URL', 'file::memory:');
  vi.stubEnv('TURSO_AUTH_TOKEN', 'local-test-only');
  vi.stubEnv('BETTER_AUTH_SECRET', 'isolated-security-test-secret-at-least-32-characters');
  vi.stubEnv('BETTER_AUTH_URL', 'https://coach.test');
  vi.stubEnv('GOOGLE_CLIENT_ID', '');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  store = await import('./db');
  db = (await store.ensureSchema())!;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db?.close();
});

function authRequest(path: string, body: object, extra: Record<string, string> = {}) {
  return new Request(`https://coach.test/api/auth/${path}`, {
    method: 'POST', headers: { origin: 'https://coach.test', 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
}

describe('authentication boundary', () => {
  it.each([undefined, '20', '999999'])('rejects auth bodies over 16 KB with declared length %s', async (length) => {
    const { POST } = await import('../app/api/auth/[...all]/route');
    const res = await POST(authRequest('sign-in/email', { email: 'a@example.test', password: 'Secret123', padding: 'x'.repeat(17000) }, length ? { 'content-length': length } : {}));
    expect(res.status).toBe(413);
  });

  it('does not authorize a replayed cookie after session revocation', async () => {
    const { auth } = await import('./auth');
    const { betterAuth } = await import('better-auth');
    // Issue the cached cookie using the old configuration, then replay it to
    // the current application after revoking its database session.
    const legacy = betterAuth({ ...auth.options, session: { ...auth.options.session, cookieCache: { enabled: true, maxAge: 300 } } });
    const res = await legacy.handler(authRequest('sign-up/email', { name: 'Test', email: 'test@example.test', password: 'Secret123' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const headers = new Headers({ cookie });
    expect((await auth.api.getSession({ headers }))?.user.email).toBe('test@example.test');
    await db.execute('DELETE FROM session');
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it('fails closed when durable login protection is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'execute').mockRejectedValue(new Error('counter unavailable'));
    const { POST } = await import('../app/api/auth/[...all]/route');
    expect((await POST(authRequest('sign-in/email', { email: 'test@example.test', password: 'Secret123' }))).status).toBe(503);
  });

  it.each(['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded; application/json'])('refuses ambiguous credential parsing: %s', async (contentType) => {
    const { POST } = await import('../app/api/auth/[...all]/route');
    const req = new Request('https://coach.test/api/auth/sign-in/email', {
      method: 'POST', headers: { origin: 'https://coach.test', 'content-type': contentType },
      body: 'email=test%40example.test&password=Secret123',
    });
    expect((await POST(req)).status).toBe(415);
  });

  it('blocks the sixth credential attempt', async () => {
    const { POST } = await import('../app/api/auth/[...all]/route');
    for (let i = 0; i < 5; i++) {
      const res = await POST(authRequest('sign-in/email', { email: 'missing@example.test', password: 'Secret123' }));
      expect(res.status).toBe(401);
    }
    expect((await POST(authRequest('sign-in/email', { email: 'missing@example.test', password: 'Secret123' }))).status).toBe(429);
  });
});

describe('usage and ownership boundaries', () => {
  it('does not grant a fresh allowance to a claimed guest token', async () => {
    for (let i = 0; i < 3; i++) expect((await store.consumeGuestUsage('guest_test')).allowed).toBe(true);
    expect(await store.mergeGuestDataIntoUser('guest_test', 'user_test')).toBe(true);
    expect((await store.consumeGuestUsage('guest_test')).allowed).toBe(false);
  });

  it('rejects paid work when quota storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'execute').mockRejectedValue(new Error('simulated database failure'));
    await expect(store.consumeDailyQuota('user_test', 'generate-speech')).rejects.toThrow();
    await expect(store.consumeGuestUsage('guest_test')).rejects.toThrow();
  });

  it('rejects paid work when database configuration is missing', async () => {
    vi.stubEnv('TURSO_AUTH_TOKEN', '');
    vi.resetModules();
    const unavailable = await import('./db');
    await expect(unavailable.consumeDailyQuota('user_test', 'generate-speech')).rejects.toThrow();
    await expect(unavailable.consumeGuestUsage('guest_test')).rejects.toThrow();
  });

  it('moves only the supplied guest’s data and preserves it on a failed merge', async () => {
    await store.insertGeneratedSpeech({ id: 'guest_script', user_id: 'guest_test', topic: 'private', template_id: null, template_label: null, word_count: 1, speech: 'private' });
    const originalBatch = db.batch.bind(db);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'batch').mockRejectedValueOnce(new Error('merge unavailable'));
    expect(await store.mergeGuestDataIntoUser('guest_test', 'user_test')).toBe(false);
    expect(await store.listGeneratedSpeeches('guest_test')).toHaveLength(1);
    vi.mocked(db.batch).mockImplementation(originalBatch);
    expect(await store.mergeGuestDataIntoUser('guest_test', 'user_test')).toBe(true);
    expect(await store.listGeneratedSpeeches('guest_test')).toHaveLength(0);
    expect(await store.listGeneratedSpeeches('user_test')).toHaveLength(1);
  });

  it('keeps the daily quota atomic under concurrent requests', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => store.consumeDailyQuota('user_test', 'generate-speech-audio')));
    expect(results.filter((result) => result.allowed)).toHaveLength(12);
  });

  it('cannot read, update or delete another account’s records', async () => {
    await store.insertSpeechSession({ id: 'session_a', user_id: 'owner_a', template_id: null, template_label: null, rubric_mode: 'general', transcript: 'private', feedback: 'private', overall_score: 70, words_per_min: 100, duration_seconds: 30 });
    await store.insertGeneratedSpeech({ id: 'speech_a', user_id: 'owner_a', topic: 'private', template_id: null, template_label: null, word_count: 1, speech: 'private' });
    expect(await store.listRecentSpeechSessions('owner_b')).toEqual([]);
    expect(await store.listGeneratedSpeeches('owner_b')).toEqual([]);
    expect(await store.getSpeechSessionScore('session_a', 'owner_b')).toBeNull();
    expect(await store.updateSpeechSessionDeepAnalysis('session_a', 'owner_b', 'tampered')).toBe(false);
    expect((await store.deleteSpeechSessionAndList('owner_b', 'session_a')).deleted).toBe(false);
    expect((await store.deleteGeneratedSpeechAndList('owner_b', 'speech_a')).deleted).toBe(false);
    expect(await store.listRecentSpeechSessions('owner_a')).toHaveLength(1);
    expect(await store.listGeneratedSpeeches('owner_a')).toHaveLength(1);
  });
});

describe('provider calls stay behind working usage protection', () => {
  const routes = {
    'generate-speech': () => import('../app/api/generate-speech/route'),
    'aawax-chat': () => import('../app/api/aawax-chat/route'),
    'generate-speech-audio': () => import('../app/api/generate-speech-audio/route'),
    'deep-analysis': () => import('../app/api/deep-analysis/route'),
    'transcribe-analyze': () => import('../app/api/transcribe-analyze/route'),
    'generate-insights': () => import('../app/api/generate-insights/route'),
  };
  it.each(Object.keys(routes) as (keyof typeof routes)[])('%s returns 503 without calling a provider', async (route) => {
    vi.stubEnv('DEEPINFRA_API_KEY', 'test-only');
    vi.stubEnv('GEMINI_API_KEY', 'test-only');
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-only');
    const { createGuestIdentity } = await import('./identity');
    const guest = createGuestIdentity()!;
    await store.insertSpeechSession({ id: 'session_a', user_id: guest.guestId, template_id: null, template_label: null, rubric_mode: 'general', transcript: 'private', feedback: 'private', overall_score: 70, words_per_min: 100, duration_seconds: 30 });
    const execute = db.execute.bind(db);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'execute').mockImplementation((statement: InStatement) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.includes('INSERT INTO usage_quota')) return Promise.reject(new Error('quota unavailable'));
      return execute(statement);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'));
    const headers = new Headers({ origin: 'https://coach.test', cookie: `aawaz_guest=${guest.token}` });
    let body: BodyInit;
    if (['generate-speech-audio', 'deep-analysis', 'transcribe-analyze'].includes(route)) {
      const form = new FormData();
      form.set('text', 'This is a practice speech.');
      form.set('file', new File([new Uint8Array(4000)], 'speech.webm', { type: 'audio/webm' }));
      body = form;
    } else {
      headers.set('content-type', 'application/json');
      body = JSON.stringify({ topic: 'Practice speech', message: 'How am I doing?' });
    }
    const { POST } = await routes[route]();
    const res = await POST(new NextRequest(`https://coach.test/api/${route}`, { method: 'POST', headers, body }));
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
