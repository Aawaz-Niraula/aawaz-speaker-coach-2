import { NextRequest } from 'next/server';

import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { ChatCompletionData } from '@/lib/ai';
import { updateSpeechSessionDeepAnalysis } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { analyseVocalDelivery, formatVocalForPrompt } from '@/lib/gemini';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { computeSpeechMetrics, formatMetricsForPrompt } from '@/lib/speech-metrics';
import { GENERAL_RUBRIC, getSpeechTemplate } from '@/lib/speech-config';

/**
 * Deep analysis: the vocal half of the coaching.
 *
 * This route is deliberately separate from /transcribe-analyze. That pipeline
 * is the one every user depends on, and nothing here can slow it down or break
 * it. The audio arrives from the browser's own memory when the user asks for a
 * deeper read, so nothing is stored server-side to make this possible.
 *
 * Whisper and Gemini run at the same time: one hears the words and their exact
 * timings, the other hears how they were said. The coach then sees both.
 */

const ANALYSIS_MODELS = ['google/gemma-4-26B-A4B-it', 'Qwen/Qwen3-14B'] as const;
const TRANSCRIPTION_MODELS = ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'] as const;

/**
 * Transcription here is slower than in the standard route: word-level
 * timestamps cost extra time, and this call shares bandwidth with the Gemini
 * upload running alongside it. A minute-long recording can legitimately take
 * well over a minute, so the budget is generous and a fallback model covers
 * a stalled first attempt.
 */
const TRANSCRIBE_TIMEOUT_MS = 110000;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

type WhisperVerbose = {
  text?: string;
  duration?: number;
  words?: unknown;
  segments?: unknown;
  error?: { message?: string };
};

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
  const GEMINI_API_KEY = process.env.Gemini_API_KEY || process.env.GEMINI_API_KEY;

  if (!DEEPINFRA_API_KEY || !GEMINI_API_KEY) {
    return Response.json({ error: 'Deep analysis is not configured on this server.' }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const sessionId = String(form.get('sessionId') || '').trim().slice(0, 80) || null;
    const selectedTemplateId = String(form.get('templateId') || '').trim().slice(0, 80) || null;

    if (!file || file.size < 3000) {
      return Response.json({ error: 'No usable audio was provided.' }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'Recording is too large for deep analysis.' }, { status: 413 });
    }

    const { userId } = await resolveAppUser(req, true);

    const rateLimit = checkRateLimit(`deep-analysis:${getClientKey(req, userId)}`, 6, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many deep analyses. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const globalLimit = checkRateLimit('global:deep-analysis', 60, 5 * 60 * 1000);
    if (!globalLimit.allowed) {
      return Response.json(
        { error: 'Deep analysis is busy right now. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(globalLimit.retryAfterSeconds) } },
      );
    }

    const template = getSpeechTemplate(selectedTemplateId);
    const audioBuffer = await file.arrayBuffer();

    /* Both halves start together. Gemini listening to the delivery takes about
       as long as Whisper transcribing, so running them in sequence would
       double the wait for no reason. */
    const transcriptionPromise = (async () => {
      let lastError = 'Transcription failed.';

      for (const model of TRANSCRIPTION_MODELS) {
        const audioForm = new FormData();
        audioForm.append('file', file, 'speech.webm');
        audioForm.append('model', model);
        audioForm.append('response_format', 'verbose_json');
        // Word-level timings are the whole point here: they are what makes
        // pause and pace analysis measurable rather than guessed.
        audioForm.append('timestamp_granularities[]', 'word');

        const res = await fetchWithRetryLimited('transcription', 'https://api.deepinfra.com/v1/openai/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${DEEPINFRA_API_KEY}` },
          body: audioForm,
        }, 0, 0, TRANSCRIBE_TIMEOUT_MS).catch(() => null);

        if (!res) {
          lastError = 'Transcription timed out.';
          continue;
        }

        const data = (await res.json().catch(() => ({}))) as WhisperVerbose;
        if (res.ok && !data.error && (data.text || '').trim()) {
          return data;
        }

        lastError = data.error?.message || `Transcription failed (${res.status}).`;
      }

      throw new Error(lastError);
    })();

    const vocalPromise = analyseVocalDelivery(
      audioBuffer,
      file.type || 'audio/webm',
      GEMINI_API_KEY,
      // Kept under the transcription budget: if Gemini is the slow one, the
      // report still lands using the timing data alone.
      100000,
    );

    const [transcriptionResult, vocalResult] = await Promise.allSettled([transcriptionPromise, vocalPromise]);

    if (transcriptionResult.status === 'rejected') {
      return Response.json(
        { error: 'Could not re-read the recording. Please try again in a moment.' },
        { status: 503 },
      );
    }

    const whisper = transcriptionResult.value;
    const transcript = (whisper.text || '').trim();
    if (!transcript) {
      return Response.json({ error: 'No speech was detected in the recording.' }, { status: 400 });
    }

    // A Gemini failure degrades the result rather than losing it: the measured
    // timing analysis is still a real upgrade over the standard report.
    const vocal = vocalResult.status === 'fulfilled' ? vocalResult.value.text : null;
    const metrics = computeSpeechMetrics(whisper, Number(whisper.duration || 0));

    if (!vocal && !metrics) {
      return Response.json(
        { error: 'Deep analysis could not read this recording. The standard report still applies.' },
        { status: 503 },
      );
    }

    const rubricInstructions = template
      ? `${template.rubricTitle}\n${template.rubric}`
      : GENERAL_RUBRIC;

    const sections = [
      metrics ? formatMetricsForPrompt(metrics) : null,
      vocal ? formatVocalForPrompt(vocal) : null,
    ].filter(Boolean).join('\n\n');

    let analysisData: ChatCompletionData = {};
    let succeeded = false;

    for (const model of ANALYSIS_MODELS) {
      const res = await fetchWithRetryLimited('chat', 'https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are Aawaz, a demanding but fair public-speaking coach, writing a DELIVERY report.

The speaker has already received feedback on their words and structure. This report covers what that one could not: how the speech actually sounded, and what the timing data shows.

- Name weaknesses plainly and specifically. Never hide a real problem to be nice.
- Give credit where the speaker earned it, as a factual observation rather than a compliment.
- No motivational fluff, no padding, no exclamation marks.
- Fixes stay purely technical and imperative.
- Never treat an accent or dialect as a delivery flaw. Judge control, not origin.
- Use the measured numbers exactly as given. Do not invent or contradict them.
- Write for someone who has never taken a speech class. Use everyday words: "you sped up in the middle", not "inconsistent pacing control"; "you barely stopped for breath", not "insufficient pause rate". Never use the words pacing, prosody, cadence, modulation, dynamic range, or vocal register. If you cite a number, say what it means in the same sentence.`,
            },
            {
              role: 'user',
              content: `Write a delivery report in EXACTLY this format:

🎧 DELIVERY ANALYSIS
• How fast you spoke: [plain sentence using the measured words/min and how it changed through the speech]
• Did you pause enough?: [plain sentence: did they leave gaps for the audience, or run words together?]${vocal ? `
• How you sounded: [warm, flat, tense, engaging? Did you sound sure of yourself?]
• Did your key points land?: [was there variation in energy, or did everything sound the same?]` : ''}
• Delivery score: X/100

🎯 WHAT YOUR VOICE DID WELL
[2-3 sentences naming specific things that genuinely worked in the delivery. If very little worked, say that plainly instead of inventing something.]

⚠️ WHAT HELD IT BACK
[2-3 direct sentences on the biggest delivery weaknesses, each tied to the measured data${vocal ? ' or what was heard' : ''}.]${vocal ? '' : `

IMPORTANT: no vocal recording data is available for this analysis — only the timing measurements. Judge pace, pausing, and rhythm only. Do NOT describe tone, warmth, confidence, vocal energy, or how the voice sounded: you cannot hear it, and guessing would be inventing findings.`}

🎤 3 DELIVERY DRILLS
[Technical and imperative only. No encouragement in this section.]
1. [a drill targeting the weakest measured metric, with reps or timing]
2. [a drill targeting the weakest vocal quality heard]
3. [a rehearsal command they can run daily]

Delivery score bands (score the DELIVERY only, not the content or structure):
  90-100 — Commanding. Controlled pace with real variation, deliberate pauses, warm confident tone, key words land.
  80-89  — Strong delivery with minor, nameable flaws.
  70-79  — Good. Clear and controlled, with a few real weaknesses.
  60-69  — Competent but inconsistent — flat stretches, or pace and pausing that drift.
  45-59  — Developing. A clear delivery problem: rushing, monotone, or almost no pausing.
  30-44  — Weak. Hard to follow because of how it was delivered.
  0-29   — Only for delivery that is genuinely unintelligible.
Use the full range. Good delivery earns a good score; do not cluster everything low.

Rubric context:
${rubricInstructions}

${sections}

Transcript (for reference only — do not re-judge the content):
${transcript.slice(0, 4000)}`,
            },
          ],
          max_tokens: 900,
          temperature: 0.3,
        }),
      }, 0, 0, 60000).catch(() => null);

      if (!res) continue;

      analysisData = (await res.json().catch(() => ({}))) as ChatCompletionData;
      if (res.ok && analysisData.choices?.[0]?.message?.content) {
        succeeded = true;
        break;
      }
    }

    if (!succeeded) {
      return Response.json(
        { error: 'The coach is busy right now. Please try the deep analysis again in a moment.' },
        { status: 503 },
      );
    }

    const report = analysisData.choices?.[0]?.message?.content ?? '';

    // Best effort: a failed save should not lose the report the user is about
    // to read. It is returned either way.
    if (sessionId) {
      await updateSpeechSessionDeepAnalysis(sessionId, userId, report).catch(() => null);
    }

    return Response.json({
      deepAnalysis: report,
      metrics,
      vocalAvailable: Boolean(vocal),
      // Surfaced so the UI can say the vocal half was skipped rather than
      // silently showing a thinner report.
      degraded: !vocal,
    });
  } catch (error) {
    if (error instanceof GuestLimitError) return guestLimitResponse();
    if (error instanceof IdentityError) return identityErrorResponse();

    console.error('Deep analysis failed:', error);
    return Response.json(
      { error: 'Deep analysis hit a snag. Your standard report is unaffected.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
