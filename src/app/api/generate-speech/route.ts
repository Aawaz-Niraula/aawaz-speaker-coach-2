import { NextRequest } from 'next/server';

import { getProviderErrorMessage, isAbortTimeout, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { getSpeechTemplate } from '@/lib/speech-config';

const SPEECH_MODELS = [
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'Qwen/Qwen3.5-9B',
] as const;

function formatSpeechGenerationError(status: number, message?: string) {
  if (status === 429) {
    return "Today's free AI limit has been reached. Please try again later.";
  }

  if (isProviderUnavailable(status, message)) {
    return 'Speech generation is temporarily busy. Please try again in a little while.';
  }

  return message || 'Failed to generate speech script.';
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 180) : '';
    const templateId = typeof body?.templateId === 'string' ? body.templateId.trim().slice(0, 80) : '';
    const template = getSpeechTemplate(templateId || null);
    const requestedWordCount = Number(body?.wordCount);
    const targetWordCount = Number.isFinite(requestedWordCount) ? Math.min(500, Math.max(80, Math.round(requestedWordCount))) : 180;
    const lowerWordCount = Math.max(70, targetWordCount - 10);
    const upperWordCount = targetWordCount + 10;

    if (topic.length < 3) {
      return Response.json({ speech: '', error: 'Please enter a valid topic.' }, { status: 400 });
    }

    const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

    if (!DEEPINFRA_API_KEY) {
      return Response.json({ speech: '', error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    const { userId, isGuest, guestRemaining } = await resolveAppUser(req, true);
    const rateKey = `generate-speech:${getClientKey(req, userId)}`;
    const rateLimit = checkRateLimit(rateKey, 20, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { speech: '', error: 'Too many speech generation requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const globalRateLimit = checkRateLimit('global:generate-speech', 180, 5 * 60 * 1000);
    if (!globalRateLimit.allowed) {
      return Response.json(
        { speech: '', error: 'Speech generation is busy right now. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': String(globalRateLimit.retryAfterSeconds) } },
      );
    }

    let lastStatus = 503;
    let lastMessage = 'Failed to generate speech script.';

    for (const model of SPEECH_MODELS) {
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
              content: template
                ? `You are a professional speechwriter. Write clear, engaging, well-structured speeches suitable for students and professionals to practice public speaking. When a speech format is specified, you MUST follow its structure, tone, protocol, and sequencing exactly — the speech will be graded against that format's rubric, so write it to score highly on every rule.`
                : 'You are a professional speechwriter. Write clear, engaging, well-structured speeches suitable for students and professionals to practice public speaking.',
            },
            {
              role: 'user',
              content: template
                ? `Write a practice speech on the topic: "${topic}" in the "${template.label}" format (${template.rubricTitle}).

The speech will be judged against this exact rubric, so it must satisfy every rule below:
${template.rubric}

Requirements:
- Aim for about ${targetWordCount} words. Stay between ${lowerWordCount} and ${upperWordCount} words if possible.
- Follow the format's structure, sequencing, tone, and protocol precisely from the first line to the last.
- Natural spoken language appropriate to the format's expected level of formality
- No stage directions, section labels, or headings — just the speech text itself`
                : `Write a public speaking sample speech on the topic: "${topic}".

Requirements:
- Aim for about ${targetWordCount} words. Stay between ${lowerWordCount} and ${upperWordCount} words if possible.
- Clear opening, 2-3 key points, strong closing
- Natural spoken language, not too formal
- No stage directions or labels, just the speech text itself`,
            },
          ],
          max_tokens: Math.ceil(targetWordCount * 2.2),
          temperature: 0.8,
        }),
      }, 0, 0, 75000).catch(() => null);

      if (!res) {
        lastStatus = 503;
        lastMessage = 'Speech generation is temporarily unavailable. Please try again in a little while.';

        if (model !== SPEECH_MODELS[SPEECH_MODELS.length - 1]) {
          continue;
        }

        break;
      }

      const data = await res.json().catch(() => ({})) as ChatCompletionData;
      lastStatus = res.ok ? 502 : res.status;
      lastMessage = getProviderErrorMessage(data) || lastMessage;

      if (data.error || !res.ok) {
        if (isProviderUnavailable(lastStatus, lastMessage) && model !== SPEECH_MODELS[SPEECH_MODELS.length - 1]) {
          continue;
        }

        return Response.json(
          { speech: '', error: formatSpeechGenerationError(lastStatus, lastMessage) },
          { status: lastStatus },
        );
      }

      const speech = data.choices?.[0]?.message?.content || '';
      if (speech.trim()) {
        return Response.json({ speech: speech.trim(), isGuest, guestRemaining });
      }

      lastMessage = 'The AI returned an empty speech. Please try again.';
    }

    return Response.json(
      { speech: '', error: formatSpeechGenerationError(lastStatus, lastMessage) },
      { status: lastStatus },
    );
  } catch (error) {
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }
    if (error instanceof IdentityError) {
      return identityErrorResponse();
    }

    return Response.json(
      { speech: '', error: isAbortTimeout(error) ? 'Speech generation timed out. Please try a shorter speech or try again.' : 'Speech generation failed. Please try again.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
