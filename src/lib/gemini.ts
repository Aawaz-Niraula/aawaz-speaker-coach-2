/**
 * Gemini vocal analysis.
 *
 * Whisper turns audio into words; everything about HOW it was said is lost in
 * that step. Gemini takes the audio natively, so tone, warmth, emphasis, and
 * audible confidence survive to the coach.
 *
 * Scope is deliberately narrow: Gemini is asked only about things that cannot
 * be recovered from a transcript or from timestamps. Pace and pauses are
 * measured from Whisper's word timings instead, because measurements beat
 * inference, and because vocal-emotion models are known to misread unfamiliar
 * accents — keeping them away from the objective metrics limits the damage a
 * bad read can do.
 */

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini bills audio at ~32 tokens/second, so a long clip is still cheap. */
const MAX_AUDIO_BYTES = 18 * 1024 * 1024;

const VOCAL_PROMPT = `You are analysing ONLY the vocal delivery in this recording. You are not judging the words, the argument, or the structure — another system handles those.

Report on what can only be heard, never read:

1. TONE — warm, flat, tense, detached, engaging? Does the voice invite the listener in or hold them at a distance?
2. CONFIDENCE — does the speaker sound certain of what they are saying? Note upspeak (statements rising like questions), trailing off at the ends of sentences, or a voice that thins out on the important lines.
3. ENERGY AND EMPHASIS — is there dynamic range, or is it delivered on one level? Do the key words actually land, or does everything get equal weight?
4. AUDIBLE NERVES — shakiness, rushed breathing, throat-clearing, swallowing, or a voice that tightens under pressure.
5. STANDOUT MOMENTS — name the strongest-sounding delivery and the weakest, with roughly when they occur.

Rules:
- Judge delivery only. Ignore grammar, vocabulary, accent, and dialect entirely. A strong accent is NOT a delivery flaw and must never be described as one.
- Be specific and concrete. "Trails off at the end of each point" is useful; "sounds nervous" is not.
- Say plainly when something is delivered well. Do not manufacture problems that are not audible.
- If the audio is too short or unclear to judge, say so rather than guessing.

Answer in under 180 words, as plain prose. No headings, no bullet points, no score.`;

export type VocalAnalysis = {
  text: string;
  model: string;
};

function extractText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (p && typeof p === 'object' ? String((p as { text?: unknown }).text ?? '') : ''))
    .join('')
    .trim();
}

function geminiErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const error = (data as { error?: { message?: unknown } }).error;
  return error && typeof error.message === 'string' ? error.message : '';
}

/**
 * Sends the recording to Gemini for a vocal read.
 * Throws on failure so the caller can decide whether to degrade gracefully.
 */
export async function analyseVocalDelivery(
  audio: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  timeoutMs = 90000,
): Promise<VocalAnalysis> {
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error('Recording is too long for vocal analysis.');
  }

  // Gemini rejects codec suffixes like "audio/webm;codecs=opus".
  const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';

  const res = await fetch(`${GEMINI_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: VOCAL_PROMPT },
          { inline_data: { mime_type: cleanMime, data: Buffer.from(audio).toString('base64') } },
        ],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(geminiErrorMessage(data) || `Vocal analysis failed (${res.status}).`);
  }

  const text = extractText(data);
  if (!text) {
    throw new Error('Vocal analysis returned no result.');
  }

  return { text, model: GEMINI_MODEL };
}

/** Wraps the vocal read for the coach prompt, with its authority scoped. */
export function formatVocalForPrompt(vocal: string) {
  return `VOCAL DELIVERY (heard directly from the audio — this is the ONLY source that can observe tone, warmth, emphasis, and audible confidence, so treat it as authoritative on those):
${vocal}

Weight this properly. How something was said is at least as important as what was said, and until now you could not hear it at all. Let it move the score in both directions: genuinely warm, confident, well-emphasised delivery should raise it, and flat or visibly nervous delivery should lower it.
Do not use this section to judge pace or pausing — the measured timing data is authoritative for those.
Never treat an accent as a delivery flaw.`;
}
