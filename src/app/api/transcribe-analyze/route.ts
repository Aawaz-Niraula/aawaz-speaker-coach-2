import { randomUUID } from 'crypto';

import { after, NextRequest } from 'next/server';

import { getProviderErrorMessage, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { DailyQuotaError, GuestLimitError, IdentityError, dailyQuotaResponse, guestLimitResponse, resolveAppUser } from '@/lib/app-user';
import { insertSpeechSession, listRecentSpeechSessions } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { formatSchemeForPrompt, getScoringScheme, totalFromBreakdown } from '@/lib/scoring';
import { parseFeedback } from '@/lib/feedback';
import { computeSpeechMetrics, formatMetricsForPrompt } from '@/lib/speech-metrics';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { GENERAL_RUBRIC, getSpeechTemplate } from '@/lib/speech-config';

const ANALYSIS_MODELS = [
  'google/gemma-4-26B-A4B-it',
  'Qwen/Qwen3-14B',
] as const;

// Turbo first: ~8x faster than whisper-large-v3 with near-identical accuracy.
// The full model stays as a fallback if turbo is unavailable.
const TRANSCRIPTION_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
] as const;

function formatApiError(prefix: string, status: number, message?: string) {
  if (status === 429) {
    return `${prefix} is temporarily unavailable because today's free AI limit has been reached. Please try again later.`;
  }

  if (status >= 500) {
    return `${prefix} is temporarily unavailable right now. Please try again in a little while.`;
  }

  return `${prefix} failed${message ? `: ${message}` : '.'}`;
}

function buildHistoryContext(history: Awaited<ReturnType<typeof listRecentSpeechSessions>>) {
  if (!history.length) {
    return 'No previous evaluations are available for this user.';
  }

  return history
    .slice(0, 4)
    .map((session, index) => {
      const feedbackSnippet = session.feedback.replace(/\s+/g, ' ').slice(0, 260);
      return [
        `Session ${index + 1}:`,
        `- Date: ${session.created_at}`,
        `- Rubric mode: ${session.rubric_mode}`,
        `- Template: ${session.template_label ?? 'None'}`,
        `- Score: ${session.overall_score ?? 'Unknown'}/100`,
        `- Pace: ${session.words_per_min ?? 'Unknown'} wpm`,
        `- Feedback summary: ${feedbackSnippet}`,
      ].join('\n');
    })
    .join('\n\n');
}

function extractOverallScore(feedback: string) {
  const match = feedback.match(/score[:\s]*(\d+)\s*\/\s*100/i);
  return match ? Number(match[1]) : null;
}

function buildModeInstructions(templateLabel: string | null) {
  if (templateLabel) {
    return `TEMPLATE MODE is active for "${templateLabel}".
Judge the speech against the selected template and its specific rubric.
Deductions must be proportional to how much of the template is actually missing: one weak or out-of-order step costs some points, ignoring the format entirely costs a lot.
If the speaker follows the template well, say so and score it well. If the transcript ignores the template's expectations, name the specific step that failed and score it low.
Your feedback, analysis, and fixes MUST reference the template's demands (protocol, structure, sequencing, tone, formality, rebuttal quality, ceremonial control, etc.).
No generic filler advice. Every critique must anchor back to the chosen template.`;
  }

  return `No template mode is active.
Use the general rubric. Be technical and reality-based about structure, pace, wording, control, and delivery mechanics.
Assume the speaker wants the truth, told in a way they can act on.
If the speech is sloppy, disorganized, vague, flat, or repetitive, say so directly and without hedging.
If parts of it genuinely work, name them specifically in one sentence, then move on to the weaknesses.
Do not manufacture praise, and do not withhold a fair score from a speech that earned it.`;
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { transcript: '', feedback: 'Invalid audio upload. Please record again.', history: [] },
      { status: 400 },
    );
  }

  const file = formData.get('file') as File | null;
  const selectedTemplateId = String(formData.get('templateId') || '').trim().slice(0, 80) || null;

  if (!file || file.size < 3000) {
    return Response.json({
      transcript: '',
      feedback: 'No audio detected. Use a proper microphone and speak clearly.',
      history: [],
    });
  }

  if (file.size > 20 * 1024 * 1024) {
    return Response.json(
      {
        transcript: '',
        feedback: 'Audio is too large. Keep recordings under 20 MB and try again.',
        history: [],
      },
      { status: 413 },
    );
  }

  let resolvedUser: Awaited<ReturnType<typeof resolveAppUser>>;
  try {
    resolvedUser = await resolveAppUser(req, true, 'transcribe-analyze');
  } catch (error) {
    if (error instanceof DailyQuotaError) {
      return dailyQuotaResponse();
    }
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }

    return Response.json(
      {
        transcript: '',
        feedback: error instanceof Error ? error.message : 'Your session could not be verified. Refresh the page and try again.',
        history: [],
      },
      { status: error instanceof IdentityError ? 401 : 400 },
    );
  }

  const { userId, isGuest, guestRemaining } = resolvedUser;

  const template = getSpeechTemplate(selectedTemplateId);
  const rubricMode = template ? `template:${template.id}` : 'general';
  const rubricInstructions = template ? template.rubric : GENERAL_RUBRIC;
  const modeInstructions = buildModeInstructions(template?.label ?? null);
  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

  if (!DEEPINFRA_API_KEY) {
    return Response.json(
      { transcript: '', feedback: 'Server configuration error: missing API key.', history: [] },
      { status: 500 },
    );
  }

  const rateKey = `transcribe-analyze:${getClientKey(req, userId)}`;
  const rateLimit = checkRateLimit(rateKey, 12, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        transcript: '',
        feedback: 'Too many analysis requests. Please wait a moment and try again.',
        history: [],
      },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const globalRateLimit = checkRateLimit('global:transcribe-analyze', 120, 5 * 60 * 1000);
  if (!globalRateLimit.allowed) {
    return Response.json(
      {
        transcript: '',
        feedback: 'Speech analysis is busy right now. Please try again in a moment.',
        history: [],
      },
      { status: 429, headers: { 'Retry-After': String(globalRateLimit.retryAfterSeconds) } },
    );
  }

  // Fetch history while the audio is being transcribed — no reason to wait.
  const historyPromise = listRecentSpeechSessions(userId, 4);

  let whisperRes: Response | null = null;
  let whisperData: {
    text?: string;
    duration?: number;
    words?: unknown;
    segments?: unknown;
    error?: { message?: string };
  } = {};

  for (const transcriptionModel of TRANSCRIPTION_MODELS) {
    const audioForm = new FormData();
    audioForm.append('file', file, 'speech.webm');
    audioForm.append('model', transcriptionModel);
    audioForm.append('response_format', 'verbose_json');
    // Word timings come back on the same call at no extra cost, and turn
    // pace and pausing from guesses into measurements.
    audioForm.append('timestamp_granularities[]', 'word');

    whisperRes = await fetchWithRetryLimited('transcription', 'https://api.deepinfra.com/v1/openai/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPINFRA_API_KEY}` },
      body: audioForm,
    }, 0, 0, 55000).catch(() => null);

    if (!whisperRes) continue;

    whisperData = await whisperRes.json().catch(() => ({}));

    // Transient failure (overload / 5xx / 429) — try the fallback model.
    if ((!whisperRes.ok && (whisperRes.status >= 500 || whisperRes.status === 429)) || (whisperData.error && transcriptionModel !== TRANSCRIPTION_MODELS[TRANSCRIPTION_MODELS.length - 1])) {
      continue;
    }

    break;
  }

  const previousHistory = await historyPromise;
  const historyContext = buildHistoryContext(previousHistory);

  if (!whisperRes) {
    return Response.json({
      transcript: '',
      feedback: 'Speech transcription is temporarily unavailable right now. Please try again in a little while.',
      history: previousHistory,
    }, { status: 503 });
  }

  if (!whisperRes.ok || whisperData.error) {
    return Response.json({
      transcript: '',
      feedback: formatApiError(
        'Speech transcription',
        whisperRes.status,
        whisperData?.error?.message,
      ),
      history: previousHistory,
    });
  }

  const transcript = whisperData.text || '';
  if (!transcript.trim()) {
    return Response.json({
      transcript,
      feedback: 'Could not detect any speech in the audio. Please speak clearly into your microphone.',
      history: previousHistory,
      rubricMode,
      template: template?.label ?? null,
    });
  }
  const duration = Number(whisperData.duration || 0);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const wordsPerMin = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;

  // Derived from the word timings above. Null on very short recordings, where
  // there is not enough timing data for the numbers to mean anything.
  const metrics = computeSpeechMetrics(whisperData, duration);
  const metricsSection = metrics ? `\n${formatMetricsForPrompt(metrics)}\n` : '';
  // Concrete weighted scheme for whichever rubric is active, so the score is
  // an addition of stated marks rather than one unexplained number.
  const scheme = getScoringScheme(template?.id ?? null);
  const schemeSection = formatSchemeForPrompt(scheme);

  let analysisData: ChatCompletionData = {};
  let analysisStatus = 503;
  let analysisMessage: string | undefined;
  let analysisSucceeded = false;

  for (const model of ANALYSIS_MODELS) {
    const analysisRes = await fetchWithRetryLimited('chat', 'https://api.deepinfra.com/v1/openai/chat/completions', {
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
          content: `You are Aawaz, a demanding but fair public-speaking coach.
Your job is to diagnose performance accurately, the way a good coach does: honest about what is broken, and equally honest about what actually worked.

Standards stay high. What changes is the wording, not the rigour.
- Name weaknesses plainly and specifically. Never hide a real problem to be nice.
- Give credit where the speaker earned it, in one clear sentence, then move to the work. Credit is a factual observation, not a compliment.
- Address the speaker as a capable person who can fix this, not as someone who failed.
- No motivational fluff, no padding, no "great job!", no exclamation marks. Encouraging means confident and matter-of-fact, not sweet.
- Fixes stay purely technical and imperative. Never add reassurance to a fix.
- Write for someone who has never taken a speech class. Use everyday words: "you sped up in the middle", not "inconsistent pacing control"; "you barely stopped for breath", not "insufficient pause rate". Never use the words pacing, prosody, cadence, modulation, dynamic range, or vocal register. If you cite a number, say what it means in the same sentence.

Every fix must include an actual speaking technique, drill, or rehearsal method.
When previous evaluations are provided, compare today's performance against recurring weaknesses. Call out repeated mistakes plainly, and note genuine improvement just as plainly.
If a template is selected, you MUST evaluate against its specific rubric and anchor every feedback point to the template's rules. A speech that ignores the template's structure cannot score well.
Score execution, not effort. But score it accurately in both directions: real competence earns a real score.`,
        },
        {
          role: 'user',
          content: `Analyse this speech transcript and reply in EXACTLY this format only:

📊 ANALYSIS
• Filler words: ${metrics ? `${metrics.fillerCount} — COPY THIS NUMBER EXACTLY, do not recount` : 'X'}
• Speaking speed: ${wordsPerMin} words/min (most speeches sit best at 130-160)${metrics ? `
• Speed control: [one plain sentence: did they speed up, slow down, or hold steady? Use the measured numbers. No jargon.]
• Pauses: [one plain sentence: did they leave gaps for the audience, or run words together? Use the measured pauses.]${metrics.fillerCount > 0 ? `
• Hesitation: [${metrics.hesitations} of ${metrics.fillerCount} fillers came after a gap. Say in plain words whether this looks like hunting for the next word or just a speech habit.]` : ''}` : ''}
• Clarity: Excellent / Good / Weak / Inaudible
• Structure: [brief judgment tied to the active rubric]
• Overall score: X/100

📐 MARK BREAKDOWN
[One line per criterion in the marking scheme, in the order given, exactly as: "Criterion name: X/Y". Then a final line "Total: X/100" whose value is the sum and matches the Overall score above.]

In every row above, when you identify a problem, quote the specific words it happened on and say what to do differently. Never leave a criticism as a general observation.

🔥 HONEST FEEDBACK
[3-5 short, direct sentences. If something genuinely worked, open with one specific sentence naming it. Then go straight to the biggest technical weakness and be blunt about it. If the speaker repeated an old mistake, say so plainly. If they fixed one, say that too. Never soften a real problem, and never invent praise for a speech that did not earn it.
Every criticism must quote the speaker's actual words and then show the improvement concretely — ideally the rewritten line. "Your opening was weak" is useless; "you opened with 'today I want to talk about time management' — a flat topic announcement. Open on the stake instead: 'You will lose four hours today and never notice'" is the standard.]

🛠️ 3 SPECIFIC FIXES
[Technical and imperative only. No encouragement, no reassurance, no praise in this section.]
Each fix must name a REAL, established speaking or writing technique — not invented advice. Draw from techniques such as:
- The rule of three for structuring points memorably
- Signposting phrases ("my second point is...") to make structure audible
- The "so what?" test: after every claim, answer why the audience should care
- Topic sentences: one sentence stating each point before the evidence
- Marking a script with slashes at every intended pause, then reading it
- Recording, listening back, and marking every filler word on the transcript
- Replacing a filler with a full stop and a two-second silence
- The callback: returning in the conclusion to the image used in the opening
- Diaphragmatic (belly) breathing for breath support and nerves
- Metronome or pacing drills for speed control
Name the technique, say exactly how to run it, give reps or a duration, and tie it to the specific fault you found. Never write vague instructions like "practise more", "repeat this line", or "be more confident".
1. [named technique for the biggest structural or content fault, with how-to and reps]
2. [named exercise for the biggest delivery fault, with how-to and reps]
3. [named exercise they can run daily, with how-to and duration]

${schemeSection}

Scoring rules:
- Use the FULL range. Scores must be calibrated to these bands, not clustered at the bottom:
  90-100 — Exceptional. Clear structure, controlled delivery, almost no filler, lands its point.
  80-89  — Strong. Well structured and well delivered with only minor, nameable flaws.
  70-79  — Good. Solid structure and clear delivery; a few real weaknesses to fix.
  55-69  — Competent. The speech works and makes its point, but structure or delivery is inconsistent.
  40-54  — Developing. A recognisable attempt with one real structural or delivery problem.
  25-39  — Weak. Rambling or unclear enough that the point does not come across.
  0-24   — Only for speech that is unintelligible, off-topic, or barely an attempt.
- Start from what the speech achieved, then deduct for specific faults. Do not start at zero and grant points grudgingly.
- A speech that makes its point and holds together belongs in the 60s or 70s even if it is unpolished. Reserve the 40s and below for speeches with a genuine structural failure, not merely unremarkable ones.
- Withholding an earned score is as inaccurate as inflating one. If you score below 55, the feedback must name the specific failure that justifies it.
- Judge the speech in front of you against a normal speaker, not against a professional keynote. Most people recording here are practising, not competing.
- If the speaker stayed on topic and the audience could follow their point, the score starts at 45 or above no matter how rough the delivery. Below 45 means the speech genuinely failed to communicate, not that it was untidy.
- Scores under 25 are for recordings that are essentially unusable: no discernible topic, incoherent, or barely any speech at all. A rambling but comprehensible speech is a 30-45, not a 15.
- Template enforcement: if a template is active, judge against its structure. Missing or out-of-order steps should cost real points, proportional to how much is missing. A speech that follows the template well should score well.
- If the transcript is vague, repetitive, casual when it should be formal, unsupported when it should be argumentative, or messy when it should be structured, say so explicitly and score accordingly.
- Score execution, not effort or sincerity. But when execution is genuinely good, say so and score it accordingly.
- Very short transcripts (under ~40 words) have little to judge. Say that plainly rather than inventing faults, and score conservatively without going near zero.
- Delivery counts toward the score, not just the words. Rushing with no pauses, metronomic pacing, or heavy hesitation are real faults; controlled pace with deliberate pausing is a real strength. Judge these from the measured data below, never from guesswork.
${metricsSection}
You must evaluate against this rubric:
${rubricInstructions}

Selected template:
${template ? `${template.label} (${template.rubricTitle})` : 'No template selected. Use the general rubric only.'}

Mode instructions:
${modeInstructions}

Previous evaluations for this same user:
${historyContext}

Transcript:
${transcript}`,
        },
      ],
      max_tokens: 900,
      temperature: 0.3,
    }),
    }, 0, 0, 60000).catch(() => null);

    if (!analysisRes) {
      analysisStatus = 503;
      analysisMessage = 'Speech analysis is temporarily unavailable right now. Please try again in a little while.';

      if (model !== ANALYSIS_MODELS[ANALYSIS_MODELS.length - 1]) {
        continue;
      }

      break;
    }

    analysisData = await analysisRes.json().catch(() => ({}));
    analysisStatus = analysisRes.status;
    analysisMessage = getProviderErrorMessage(analysisData);

    if (!analysisRes.ok || analysisData.error) {
      if (isProviderUnavailable(analysisStatus, analysisMessage) && model !== ANALYSIS_MODELS[ANALYSIS_MODELS.length - 1]) {
        continue;
      }

      break;
    }

    analysisSucceeded = true;
    break;
  }

  if (!analysisSucceeded) {
    return Response.json({
      transcript,
      feedback: formatApiError(
        'Speech analysis',
        analysisStatus,
        analysisMessage,
      ),
      history: previousHistory,
    });
  }

  const rawFeedback = analysisData.choices?.[0]?.message?.content || 'No feedback from coach.';
  /* The prompt tells the model to copy the measured filler count verbatim,
     because left to itself it recounts from the transcript and contradicts the
     audio. That instruction sometimes survives into the reply, so strip it. */
  const feedback = rawFeedback
    .replace(/\s*—?\s*COPY THIS NUMBER EXACTLY[^\n]*/gi, '')
    .replace(/\s*\[?do not recount\]?/gi, '');
  /* Correct the headline number from the breakdown the model produced.
     Models drift when adding: in testing they reported totals 4-5 points off
     their own marks. The breakdown is what a user can check, so it wins. */
  const parsedMarks = parseFeedback(feedback).markBreakdown;
  const correctedTotal = totalFromBreakdown(parsedMarks, scheme);
  const reportedScore = extractOverallScore(feedback);
  const overallScore = correctedTotal ?? reportedScore;
  const feedbackWithScore = correctedTotal !== null && correctedTotal !== reportedScore
    ? feedback
        .replace(/(overall score[:\s-]*)\d+(\/100)/i, `$1${correctedTotal}$2`)
        .replace(/(^|\n)(\s*[•\-*]?\s*Total:\s*)\d+(\s*\/\s*100)/i, `$1$2${correctedTotal}$3`)
    : feedback;

  const newSessionHeader = {
    id: randomUUID(),
    user_id: userId,
    template_id: template?.id ?? null,
    template_label: template?.label ?? null,
    rubric_mode: rubricMode,
    transcript,
    feedback: feedbackWithScore,
    overall_score: overallScore,
    words_per_min: wordsPerMin || null,
    duration_seconds: duration || null,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const updatedHistory = [newSessionHeader, ...previousHistory].slice(0, 6);

  after(async () => {
    try {
      await insertSpeechSession({
        id: newSessionHeader.id,
        user_id: newSessionHeader.user_id,
        template_id: newSessionHeader.template_id,
        template_label: newSessionHeader.template_label,
        rubric_mode: newSessionHeader.rubric_mode,
        transcript: newSessionHeader.transcript,
        feedback: newSessionHeader.feedback,
        overall_score: newSessionHeader.overall_score,
        words_per_min: newSessionHeader.words_per_min,
        duration_seconds: newSessionHeader.duration_seconds,
      });
    } catch (e) {
      console.error('Failed to insert speech session in background:', e);
    }
  });

  return Response.json({
    transcript,
    feedback: feedbackWithScore,
    history: updatedHistory,
    isGuest,
    guestRemaining,
    rubricMode,
    template: template?.label ?? null,
    // Null when the recording is too short for the timings to mean anything.
    metrics,
  });
}

export const runtime = 'nodejs';
export const maxDuration = 300;
