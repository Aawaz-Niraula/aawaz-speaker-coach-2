import { describe, expect, it } from 'vitest';
import { readBoundedRequest, readFormData, readJsonObject } from './body';

function streamedBody(text: string, headers: Record<string, string> = {}) {
  return new Request('https://coach.test/api/test', {
    method: 'POST', headers,
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }),
    duplex: 'half',
  } as RequestInit);
}

describe('streaming body guards', () => {
  it('counts UTF-8 bytes, not characters', async () => {
    const result = await readJsonObject(streamedBody(JSON.stringify({ text: 'é'.repeat(20) })), 40);
    expect(result.response?.status).toBe(413);
  });

  it.each(['null', '[]', '42', '"string"', '{bad'])('rejects non-object JSON: %s', async (body) => {
    expect((await readJsonObject(streamedBody(body))).response?.status).toBe(400);
  });

  it('bounds multipart uploads even without Content-Length', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array(5000)], 'speech.webm', { type: 'audio/webm' }));
    const encoded = new Request('https://coach.test/api/test', { method: 'POST', body: form });
    // Supply network-style bytes. Cancelling Node 26's outbound FormData
    // serializer itself hits an unrelated undici closed-stream rejection.
    const bytes = await encoded.arrayBuffer();
    const req = new Request('https://coach.test/api/test', {
      method: 'POST', headers: encoded.headers,
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(bytes)); controller.close(); } }),
      duplex: 'half',
    } as RequestInit);
    expect((await readFormData(req, 1024)).response?.status).toBe(413);
  });

  it('preserves a bounded auth body and its security headers', async () => {
    const text = JSON.stringify({ email: 'person@example.test', password: 'Secret123' });
    const result = await readBoundedRequest(streamedBody(text, { cookie: 'session=test', origin: 'https://coach.test' }), 1024);
    expect(result.request?.headers.get('cookie')).toBe('session=test');
    expect(result.request?.headers.get('origin')).toBe('https://coach.test');
    expect(await result.request?.text()).toBe(text);
  });
});
