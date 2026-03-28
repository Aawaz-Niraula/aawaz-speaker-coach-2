import { randomUUID } from 'crypto';

import { NextRequest } from 'next/server';

import { insertSpeechSession, listRecentSpeechSessions } from '@/lib/db';
import { GENERAL_RUBRIC, getSpeechTemplate } from '@/lib/speech-config';

function formatGroqError(prefix: string, status: number, message?: string) {
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
  const match = feedback.match(/overall score[:\s]*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

type ResponseContentPart =
  | string
  | {
      text?: string;
      content?: string;
    };

function extractAssistantText(analysisData: unknown) {
  const parsed = analysisData as {
    choices?: Array<{
      message?: {
        content?: string | ResponseContentPart[];
        reasoning?: string;
      };
      text?: string;
    }>;
    output_text?: string;
  };
  const message = parsed?.choices?.[0]?.message;

  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message?.content)) {
    const text = message.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n')
      .trim();

    if (text) return text;
  }

  if (typeof parsed?.choices?.[0]?.text === 'string' && parsed.choices[0].text.trim()) {
    return parsed.choices[0].text.trim();
  }

  if (typeof parsed?.output_text === 'string' && parsed.output_text.trim()) {
    return parsed.output_text.trim();
  }

  if (typeof message?.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning.trim();
  }

  return '';
}

function buildModeInstructions(templateLabel: string | null) {
  if (templateLabel) {
    return `Template mode is active: ${templateLabel}.
You must judge the speech primarily against the selected template, not against generic speaking advice.
If the transcript violates the template's expectations, say that explicitly and lower the score hard.
Your feedback and fixes must stay tied to the template's demands: protocol, structure, sequencing, tone, formality, rebuttal quality, or ceremonial control, depending on the selected template.
Do not drift into generic filler advice like "be more confident" unless you tie it to a template-specific failure.`;
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
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const userId = String(formData.get('userId') || '').trim();
  const selectedTemplateId = String(formData.get('templateId') || '').trim() || null;

  if (!file || file.size < 3000) {
    return Response.json({
      transcript: '',
      feedback: 'No audio detected. Use a proper microphone and speak clearly.',
      history: [],
    });
  }

  if (!userId) {
    return Response.json(
      {
        transcript: '',
        feedback: 'User identity is missing. Refresh the page and try again.',
        history: [],
      },
      { status: 400 },
    );
  }

  const template = getSpeechTemplate(selectedTemplateId);
  const rubricMode = template ? `template:${template.id}` : 'general';
  const rubricInstructions = template ? template.rubric : GENERAL_RUBRIC;
  const modeInstructions = buildModeInstructions(template?.label ?? null);
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  const previousHistory = await listRecentSpeechSessions(userId, 4);
  const historyContext = buildHistoryContext(previousHistory);

  const audioForm = new FormData();
  audioForm.append('file', file, 'speech.webm');
  audioForm.append('model', 'whisper-large-v3');
  audioForm.append('response_format', 'verbose_json');

  const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: audioForm,
  });

  const whisperData = await whisperRes.json();

  if (!whisperRes.ok || whisperData.error) {
    return Response.json({
      transcript: '',
      feedback: formatGroqError(
        'Speech transcription',
        whisperRes.status,
        whisperData?.error?.message,
      ),
      history: previousHistory,
    });
  }

  const transcript = whisperData.text || '';
  const duration = Number(whisperData.duration || 0);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const wordsPerMin = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;

  const analysisRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      include_reasoning: false,
      reasoning_effort: 'low',
      max_completion_tokens: 1400,
      messages: [
        {
          role: 'user',
          content: `You are Aawaz, a ruthless but technically precise public-speaking coach.
Your job is to diagnose performance, not comfort the speaker.
Be direct, sharp, unsentimental, and specific.
Do not use motivational fluff.
Do not soften criticism.
Every fix must include an actual speaking technique, drill, or rehearsal method.
When previous evaluations are provided, compare today's performance against recurring weaknesses and call out repeated mistakes.
If a template is selected, obey that template strictly and punish mismatch.
If no template is selected, be harsher, more technical, and more unforgiving than a normal coach.
Reality matters more than kindness.
Give the final answer directly and do not spend many tokens on internal reasoning.

Analyse this speech transcript and reply in EXACTLY this format only:

ANALYSIS:
- Total filler words (um/uh/like/you know/so): X
- Speaking speed: ${wordsPerMin} words/min (target 130-160)
- Clarity & volume: Excellent / Good / Weak / Inaudible
- Structure check: [brief judgment tied to the active rubric]
- Overall score: X/100

BRUTALLY HONEST FEEDBACK:
[2-5 short, direct sentences. Start with the biggest technical weakness. If the speaker repeated an old mistake, say so plainly. If the structure or tone is bad, say it bluntly.]

3 SPECIFIC FIXES:
1. [one exact behavior change with a technical speaking instruction tied to the rubric failure]
2. [one drill they can practice, with reps, timing, or structure, tied to the rubric failure]
3. [one daily repetition line or rehearsal command written in imperative form and tied to the rubric failure]

Scoring rules:
- Be strict. Do not hand out high scores for average speaking.
- If structure is weak, score must drop hard.
- If the selected template is violated, score must drop hard.
- If the transcript is vague, repetitive, casual when it should be formal, or unsupported when it should be argumentative, say so explicitly.
- Do not reward intent, effort, or courage. Score execution only.

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
      temperature: 0.45,
    }),
  });

  const analysisData = await analysisRes.json();

  if (!analysisRes.ok || analysisData.error) {
    return Response.json({
      transcript,
      feedback: formatGroqError(
        'Speech analysis',
        analysisRes.status,
        analysisData?.error?.message,
      ),
      history: previousHistory,
    });
  }

  const feedback =
    extractAssistantText(analysisData) ||
    `Speech analysis returned no readable content. Raw response: ${JSON.stringify(analysisData).slice(0, 1200)}`;
  const overallScore = extractOverallScore(feedback);

  await insertSpeechSession({
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
  });

  const updatedHistory = await listRecentSpeechSessions(userId, 6);

  return Response.json({
    transcript,
    feedback,
    history: updatedHistory,
    rubricMode,
    template: template?.label ?? null,
  });
}

export const runtime = 'nodejs';
