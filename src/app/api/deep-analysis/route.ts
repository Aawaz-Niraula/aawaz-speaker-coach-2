import { NextRequest } from 'next/server';

import { DailyQuotaError, GuestLimitError, IdentityError, dailyQuotaResponse, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { ANALYSIS_MODELS, TRANSCRIPTION_MODELS, type ChatCompletionData } from '@/lib/ai';
import { getSpeechSessionScore, updateSpeechSessionDeepAnalysis } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { analyseVocalDelivery, formatVocalForPrompt } from '@/lib/gemini';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { isCompleteFeedbackReport, sanitizeModelReport } from '@/lib/feedback';
import { DELIVERY_SCHEME, formatSchemeForPrompt } from '@/lib/scoring';
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

    const { userId } = await resolveAppUser(req, true, 'deep-analysis');

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

    // Fetched alongside the analysis work, not before it: the delivery score
    // anchors to this so the two reports cannot contradict each other.
    const contentScorePromise = sessionId
      ? getSpeechSessionScore(sessionId, userId).catch(() => null)
      : Promise.resolve(null);

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

    const contentScore = await contentScorePromise;

    /* Both reports grade the same performance, so wildly different numbers
       read as the app contradicting itself. The delivery score is free to
       differ — delivery genuinely can be better or worse than content — but
       a large gap has to be earned and explained. */
    const anchorSection = typeof contentScore === 'number'
      ? `SCORE ANCHOR
The speaker already received ${contentScore}/100 for the content and structure of this same speech.
Your delivery score should normally land within about 12 points of that, because a speech that is well organised is usually delivered with some control, and vice versa.
Go further apart ONLY when the evidence clearly justifies it — for example strong arguments delivered in a flat rush, or thin content carried by excellent delivery. When you do, say so explicitly in the feedback so the difference is understandable rather than confusing.
Never contradict the other report: it judged WHAT was said, you are judging HOW it was said.`
      : '';

    const sections = [
      metrics ? formatMetricsForPrompt(metrics) : null,
      vocal ? formatVocalForPrompt(vocal) : null,
      anchorSection || null,
    ].filter(Boolean).join('\n\n');

    let analysisData: ChatCompletionData = {};
    let succeeded = false;
    let validatedReport = '';

    for (const model of ANALYSIS_MODELS) {
      const res = await fetchWithRetryLimited('chat', 'https://api.deepinfra.com/v1/openai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          chat_template_kwargs: { thinking: false },
          reasoning_effort: 'none',
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
• Speed: [plain sentence using the measured words/min and how it changed through the speech]
• Pauses: [plain sentence: did they leave gaps for the audience, or run words together?]${vocal ? `
• Tone: [warm, flat, tense, engaging? Quote a moment from the vocal notes.]
• Emotion: [the emotion actually in the voice, and whether it matched the words]
• Conviction: [confidence, upspeak, trailing off — quote where it happened]
• Emphasis: [name the exact words that landed, and any that passed by flat]` : ''}
• Delivery score: X/100

📐 MARK BREAKDOWN
[One line per criterion in the marking scheme, in order, exactly as: "Criterion name: X/Y". Then "Total: X/100" whose value is the sum and matches the Delivery score above.]

In every row above, when you identify a problem, quote the specific words it happened on and say what to do differently on that phrase. Never leave a criticism as a general observation.

🎯 WHAT YOUR VOICE DID WELL
[2-3 sentences naming specific things that genuinely worked in the delivery. If very little worked, say that plainly instead of inventing something.]

⚠️ WHAT HELD IT BACK
[2-3 direct sentences on the biggest delivery weaknesses, each tied to the measured data${vocal ? ' or what was heard' : ''}. Every criticism must name the exact moment — quote the words${vocal ? ' or give the timestamp' : ''} — and then say concretely what to do differently on that specific phrase. "You rushed" is useless; "you ran 'twenty-three minutes' straight into the next sentence — stop for two full seconds after it so the number lands" is the standard.]${vocal ? '' : `

IMPORTANT: no vocal recording data is available for this analysis — only the timing measurements. Judge pace, pausing, and rhythm only. Do NOT describe tone, warmth, confidence, vocal energy, or how the voice sounded: you cannot hear it, and guessing would be inventing findings.`}

🎤 3 DELIVERY DRILLS
[Technical and imperative only. No encouragement in this section.]
Each drill must be a REAL, named exercise used in speech training — not invented advice. Draw from established techniques such as:
- Diaphragmatic (belly) breathing for breath support and nerves
- The "cork/pencil in teeth" articulation drill for slurred or clipped endings
- Tongue twisters (e.g. "red leather, yellow leather") for diction
- Humming and lip trills to warm up and open resonance
- Sirening (gliding low to high) to widen pitch range against monotone
- Marking a script with slashes at every intended pause, then reading it
- Metronome or pacing drills for speed control
- Reading aloud with exaggerated emotion, then dialling it back 50%
- Recording, listening back, and marking every filler word on the transcript
- Projecting to a fixed point across the room for volume and support
- The "power pause": stopping fully for two seconds after each key sentence
Name the technique, say exactly how to do it, give reps or a duration, and tie it to the specific fault you identified. Never write vague instructions like "practise more", "repeat this line", or "work on your pacing".
1. [named exercise for the weakest measured metric, with how-to and reps]
2. [named exercise for the weakest vocal quality heard, with how-to and reps]
3. [named exercise they can run daily, with how-to and duration]

${formatSchemeForPrompt(DELIVERY_SCHEME)}

Score the DELIVERY only, not the content or structure. Judge against a normal speaker practising, not a professional keynote. If the speaker was audible and could be followed, the total should land at 45 or above however rough it was.

Rubric context:
${rubricInstructions}

${sections}

Transcript (for reference only — do not re-judge the content):
${transcript.slice(0, 4000)}`,
            },
          ],
          max_tokens: 1100,
          temperature: 0.3,
        }),
      }, 0, 0, 60000).catch(() => null);

      if (!res) continue;

      analysisData = (await res.json().catch(() => ({}))) as ChatCompletionData;
      const candidate = sanitizeModelReport(analysisData.choices?.[0]?.message?.content || '');
      if (res.ok && isCompleteFeedbackReport(candidate)) {
        validatedReport = candidate;
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

    const report = validatedReport;

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
    if (error instanceof DailyQuotaError) return dailyQuotaResponse();
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
