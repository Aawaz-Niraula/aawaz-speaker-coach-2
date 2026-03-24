import { randomUUID } from 'crypto';

import { NextRequest } from 'next/server';

import { insertSpeechSession, listRecentSpeechSessions } from '@/lib/db';
import { GENERAL_RUBRIC, getSpeechTemplate } from '@/lib/speech-config';

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

  if (whisperData.error) {
    return Response.json({
      transcript: '',
      feedback: `Groq Whisper error: ${whisperData.error.message}`,
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
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are Aawaz, a ruthless but technically precise public-speaking coach.
Your job is to diagnose performance, not comfort the speaker.
Be direct, sharp, unsentimental, and specific.
Do not use motivational fluff.
Do not soften criticism.
Every fix must include an actual speaking technique, drill, or rehearsal method.
When previous evaluations are provided, compare today's performance against recurring weaknesses and call out repeated mistakes.`,
        },
        {
          role: 'user',
          content: `Analyse this speech transcript and reply in EXACTLY this format only:

ANALYSIS:
- Total filler words (um/uh/like/you know/so): X
- Speaking speed: ${wordsPerMin} words/min (target 130-160)
- Clarity & volume: Excellent / Good / Weak / Inaudible
- Structure check: [brief judgment tied to the active rubric]
- Overall score: X/100

BRUTALLY HONEST FEEDBACK:
[2-4 short, direct sentences. Start with the biggest technical weakness. If the speaker repeated an old mistake, say so plainly.]

3 SPECIFIC FIXES:
1. [one exact behavior change with a technical speaking instruction]
2. [one drill they can practice, with reps, timing, or structure]
3. [one daily repetition line or rehearsal command written in imperative form]

You must evaluate against this rubric:
${rubricInstructions}

Selected template:
${template ? `${template.label} (${template.rubricTitle})` : 'No template selected. Use the general rubric only.'}

Previous evaluations for this same user:
${historyContext}

Transcript:
${transcript}`,
        },
      ],
      max_tokens: 750,
      temperature: 0.45,
    }),
  });

  const analysisData = await analysisRes.json();

  if (analysisData.error) {
    return Response.json({
      transcript,
      feedback: `Groq analysis error: ${analysisData.error.message}`,
      history: previousHistory,
    });
  }

  const feedback = analysisData.choices?.[0]?.message?.content || 'No feedback from coach.';
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
