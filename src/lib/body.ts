/**
 * Request body guards.
 *
 * Every route used to call req.json() or req.formData() and only look at the
 * size afterwards, which means the whole body was already in memory by the
 * time it was rejected. These helpers put the ceiling in front of the parse:
 * a Content-Length above the cap is refused without reading a byte, and a
 * body that omits the header is read through a counting stream that aborts
 * the moment it crosses the cap.
 */

/** JSON bodies on this app are a few hundred bytes; 64 KB is a generous cap. */
export const MAX_JSON_BYTES = 64 * 1024;

/** Recordings are capped at 20 MB, plus headroom for the multipart framing. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super('Request body is too large.');
    this.name = 'BodyTooLargeError';
  }
}

export function payloadTooLargeResponse(message = 'Request is too large.') {
  return Response.json({ error: message }, { status: 413 });
}

export function malformedBodyResponse(message = 'Request body is malformed.') {
  return Response.json({ error: message }, { status: 400 });
}

/** True when the declared length alone already exceeds the cap. */
export function declaredLengthExceeds(req: Request, maxBytes: number) {
  const header = req.headers.get('content-length');
  if (!header) return false;
  const length = Number(header);
  return Number.isFinite(length) && length > maxBytes;
}

/**
 * Wraps the request body in a counting stream so nothing downstream can
 * buffer more than `maxBytes`, whatever the headers claim.
 */
function limitedBody(req: Request, maxBytes: number): Request {
  if (!req.body) return req;

  let received = 0;
  const limited = req.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new BodyTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );

  // Node needs `duplex` for a streaming body; the DOM typings do not know it.
  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: limited,
    duplex: 'half',
  } as RequestInit);
}

export type JsonObject = Record<string, unknown>;

/** Bound opaque auth bodies before either the limiter or Better Auth parses them. */
export async function readBoundedRequest(req: Request, maxBytes: number): Promise<
  { request: Request; response?: undefined } | { request?: undefined; response: Response }
> {
  if (declaredLengthExceeds(req, maxBytes)) return { response: payloadTooLargeResponse() };
  try {
    const bytes = await limitedBody(req, maxBytes).arrayBuffer();
    const headers = new Headers(req.headers);
    headers.delete('transfer-encoding');
    headers.set('content-length', String(bytes.byteLength));
    return { request: new Request(req.url, { method: req.method, headers, body: bytes, signal: req.signal }) };
  } catch (error) {
    return { response: error instanceof BodyTooLargeError ? payloadTooLargeResponse() : malformedBodyResponse() };
  }
}

/**
 * Reads a JSON object body of at most `maxBytes`.
 *
 * Arrays, primitives and null are rejected as malformed: every route here
 * expects an object, and accepting anything else only widens what has to be
 * defended against further down.
 */
export async function readJsonObject(
  req: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<{ body: JsonObject; response?: undefined } | { body?: undefined; response: Response }> {
  if (declaredLengthExceeds(req, maxBytes)) {
    return { response: payloadTooLargeResponse() };
  }

  let text: string;
  try {
    text = await limitedBody(req, maxBytes).text();
  } catch (error) {
    if (error instanceof BodyTooLargeError) return { response: payloadTooLargeResponse() };
    return { response: malformedBodyResponse() };
  }

  if (!text.trim()) return { body: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { response: malformedBodyResponse('Request body must be valid JSON.') };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { response: malformedBodyResponse('Request body must be a JSON object.') };
  }

  return { body: parsed as JsonObject };
}

/** Reads a multipart body of at most `maxBytes`. */
export async function readFormData(
  req: Request,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<{ form: FormData; response?: undefined } | { form?: undefined; response: Response }> {
  if (declaredLengthExceeds(req, maxBytes)) {
    return { response: payloadTooLargeResponse('Upload is too large.') };
  }

  try {
    return { form: await limitedBody(req, maxBytes).formData() };
  } catch (error) {
    if (error instanceof BodyTooLargeError) return { response: payloadTooLargeResponse('Upload is too large.') };
    return { response: malformedBodyResponse('Invalid upload. Please record again.') };
  }
}

/** Reads a form field as trimmed text, capped at `maxLength`. */
export function formText(form: FormData, name: string, maxLength: number) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/** Record ids are UUIDs; anything outside this alphabet is not one of ours. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

/**
 * Browsers label MediaRecorder output audio/webm, audio/mp4, or (Chrome on
 * some platforms) video/webm. A blank type is tolerated; anything that
 * declares itself to be something else entirely is refused before it costs
 * a transcription call.
 */
export function isAudioUpload(file: File) {
  const type = file.type.split(';')[0].trim().toLowerCase();
  return !type || type.startsWith('audio/') || type === 'video/webm' || type === 'video/mp4' || type === 'application/octet-stream';
}

/**
 * Pulls the recording out of a multipart form and applies every check in one
 * place: present, plausibly audio, not silence-sized, not oversized.
 */
export function pickAudioFile(form: FormData, field = 'file'): { file: File; response?: undefined } | { file?: undefined; response: Response; reason: 'missing' | 'type' | 'size' } {
  const entry = form.get(field);
  const file = entry instanceof File ? entry : null;

  if (!file || file.size < 3000) {
    return { response: Response.json({ error: 'No usable audio was provided.' }, { status: 400 }), reason: 'missing' };
  }

  if (!isAudioUpload(file)) {
    return { response: Response.json({ error: 'Only audio recordings can be analysed.' }, { status: 415 }), reason: 'type' };
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return { response: payloadTooLargeResponse('Recording is too large. Keep recordings under 20 MB and try again.'), reason: 'size' };
  }

  return { file };
}
