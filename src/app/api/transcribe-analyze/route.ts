import { randomUUID } from 'crypto';

import { after, NextRequest } from 'next/server';

import { getProviderErrorMessage, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, resolveAppUser } from '@/lib/app-user';
import { getSpeechVoiceSample, insertSpeechSession, listRecentSpeechSessions, upsertSpeechVoiceSample } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { GENERAL_RUBRIC, getSpeechTemplate } from '@/lib/speech-config';

const ANALYSIS_MODELS = [
  'google/gemma-4-26B-A4B-it',
  'Qwen/Qwen3-14B',
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
    return `CRITICAL TEMPLATE ENFORCEMENT: Template mode is active for "${templateLabel}".
You MUST judge the speech EXCLUSIVELY against the selected template and its specific rubric.
Any deviation from the template's expected structure, vocabulary, tone, or protocol MUST result in a severe score deduction.
If the transcript ignores the template's expectations, explicitly call out the template failure and immediately fail the score (< 50/100).
Your feedback, analysis, and fixes MUST strictly reference the template's demands (protocol, structure, sequencing, tone, formality, rebuttal quality, ceremonial control, etc.).
ABSOLUTELY NO drift into generic filler advice. Generic advice is forbidden. Every critique must anchor back to the chosen template.
If the tone, structure, or sequencing breaks the template, declare it a total template failure directly.`;
  }

  return `No template mode is active.
Use the general rubric, but make the coaching even harsher, more technical, and more reality-based.
Assume the speaker wants the truth, not comfort.
If the speech is sloppy, disorganized, weak, vague, flat, soft, repetitive, or structurally amateur, say so directly.
Do not protect the speaker's feelings.
Do not give friendly encouragement unless it is earned by actual execution quality.
Prioritize ruthless technical honesty about structure, pace, wording, control, and delivery mechanics.`;
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
  const voiceSample = formData.get('voiceSample') as File | null;
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

  if (voiceSample && voiceSample.size > 8 * 1024 * 1024) {
    return Response.json(
      {
        transcript: '',
        feedback: 'Voice sample is too large. Record a shorter speech analysis and try again.',
        history: [],
      },
      { status: 413 },
    );
  }

  let resolvedUser: Awaited<ReturnType<typeof resolveAppUser>>;
  try {
    resolvedUser = await resolveAppUser(req, true);
  } catch (error) {
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

  const previousHistory = await listRecentSpeechSessions(userId, 4);
  const historyContext = buildHistoryContext(previousHistory);

  const audioForm = new FormData();
  audioForm.append('file', file, 'speech.webm');
  audioForm.append('model', 'openai/whisper-large-v3');
  audioForm.append('response_format', 'verbose_json');

  const whisperRes = await fetchWithRetryLimited('transcription', 'https://api.deepinfra.com/v1/openai/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${DEEPINFRA_API_KEY}` },
    body: audioForm,
  }, 1, 1000, 75000).catch(() => null);

  if (!whisperRes) {
    return Response.json({
      transcript: '',
      feedback: 'Speech transcription is temporarily unavailable right now. Please try again in a little while.',
      history: previousHistory,
    }, { status: 503 });
  }

  const whisperData = await whisperRes.json().catch(() => ({}));

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
          content: `You are Aawaz, a ruthless but technically precise public-speaking coach.
Your job is to diagnose performance, not comfort the speaker.
Be direct, sharp, unsentimental, and specific.
Do not use motivational fluff.
Do not soften criticism.
Do not flatter weak speaking.
Every fix must include an actual speaking technique, drill, or rehearsal method.
When previous evaluations are provided, compare today's performance against recurring weaknesses and call out repeated mistakes.
If a template is selected, you MUST evaluate EXCLUSIVELY against its specific rubric. Obey that template strictly, severely punish any mismatch, and anchor every single feedback point to the template's rules.
If no template is selected, be harsher, more technical, and more unforgiving than a normal coach.
Reality matters more than kindness.
Score execution only, never effort.`,
        },
        {
          role: 'user',
          content: `Analyse this speech transcript and reply in EXACTLY this format only:

📊 ANALYSIS
• Total filler words (um/uh/like/you know/so): X
• Speaking speed: ${wordsPerMin} words/min (target 130-160)
• Clarity & volume: Excellent / Good / Weak / Inaudible
• Structure check: [brief judgment tied to the active rubric]
• Overall score: X/100

🔥 BRUTALLY HONEST FEEDBACK
[3-5 short, direct sentences. Start with the biggest technical weakness. Be blunt. If the speaker repeated an old mistake, say so plainly. If the structure, tone, protocol, or logic is weak, say it without softening it.]

🛠️ 3 SPECIFIC FIXES
1. [one exact behavior change with a technical speaking instruction tied to the rubric failure]
2. [one drill they can practice, with reps, timing, or structure, tied to the rubric failure]
3. [one daily repetition line or rehearsal command written in imperative form and tied to the rubric failure]

Scoring rules:
- Be strictly objective. Average speaking should not get a high score.
- STRICT TEMPLATE ENFORCEMENT: If a template is active, any failure to follow its exact structure, tone, and protocol MUST result in a heavily penalized score. No exceptions.
- If structure is weak, score must drop hard.
- If the transcript is vague, repetitive, casual when it should be formal, unsupported when it should be argumentative, or messy when it should be structured, say so explicitly.
- Do not reward effort, bravery, or sincerity. Score execution only.
- A speech that sounds unprepared, loose, amateur, or poorly controlled must be called that directly.

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
    }, 0, 0, 75000).catch(() => null);

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

  const feedback = analysisData.choices?.[0]?.message?.content || 'No feedback from coach.';
  const overallScore = extractOverallScore(feedback);

  const newSessionHeader = {
    id: randomUUID(),
    user_id: userId,
    template_id: template?.id ?? null,
    template_label: template?.label ?? null,
    rubric_mode: rubricMode,
    transcript,
    feedback,
    overall_score: overallScore,
    words_per_min: wordsPerMin || null,
    duration_seconds: duration || null,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const updatedHistory = [newSessionHeader, ...previousHistory].slice(0, 6);
  const existingVoiceSample = await getSpeechVoiceSample(userId);
  const hasUsableVoiceSample = !!existingVoiceSample && existingVoiceSample.size_bytes >= 3000;
  const hasNewUsableVoiceSample = !!voiceSample && voiceSample.size >= 3000;
  let voiceSampleSaved = hasUsableVoiceSample;

  if (!hasUsableVoiceSample && hasNewUsableVoiceSample) {
    try {
      const sampleToStore = voiceSample!;
      const sampleBytes = await sampleToStore.arrayBuffer();
      voiceSampleSaved = await upsertSpeechVoiceSample({
        userId,
        audioData: sampleBytes,
        mimeType: sampleToStore.type || 'audio/webm;codecs=opus',
        filename: sampleToStore.name || 'voice-sample.webm',
      });
    } catch (error) {
      console.error('Failed to prepare speech voice sample:', error);
      voiceSampleSaved = false;
    }
  }

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
    feedback,
    history: updatedHistory,
    voiceSampleSaved,
    isGuest,
    guestRemaining,
    rubricMode,
    template: template?.label ?? null,
  });
}

export const runtime = 'nodejs';
export const maxDuration = 300;
