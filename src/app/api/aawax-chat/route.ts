import { NextRequest } from 'next/server';

import { getProviderErrorMessage, isAbortTimeout, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const AAWAX_MODEL = process.env.DEEPINFRA_AAWAX_MODEL || 'deepseek-ai/DeepSeek-V4-Flash';

function formatAawaxError(status: number, message?: string) {
  if (status === 429) {
    return "Aawax's daily AI limit has been reached. Please try again later.";
  }

  if (isProviderUnavailable(status, message)) {
    return 'Aawax is temporarily busy. Please ask again in a moment.';
  }

  return message || 'Aawax could not answer right now.';
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 900) : '';
    const tab = typeof body?.tab === 'string' ? body.tab.trim().slice(0, 40) : 'coach';

    if (message.length < 2) {
      return Response.json({ answer: '', error: 'Ask Aawax a real question first.' }, { status: 400 });
    }

    const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
    if (!DEEPINFRA_API_KEY) {
      return Response.json({ answer: '', error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    const { userId } = await resolveAppUser(req, true);
    const rateKey = `aawax-chat:${getClientKey(req, userId)}`;
    const rateLimit = checkRateLimit(rateKey, 30, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { answer: '', error: 'Too many Aawax questions. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const globalRateLimit = checkRateLimit('global:aawax-chat', 240, 5 * 60 * 1000);
    if (!globalRateLimit.allowed) {
      return Response.json(
        { answer: '', error: 'Aawax is busy right now. Please ask again in a moment.' },
        { status: 429, headers: { 'Retry-After': String(globalRateLimit.retryAfterSeconds) } },
      );
    }

    const res = await fetchWithRetryLimited('chat', 'https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AAWAX_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are Aawax, the cute but sharp AI companion inside Aawaz Speaker Coach. Your creator is Aawaz.
You know the app's features: Speaking Coach speech recording and AI feedback, rubric/template selection, Speech Practice script generation, example voice audio, user's own saved voice sample/voice clone audio, Speech History, Progress insights, Account, avatar profile, Aawax customizer, tutorial, and help controls.
If users ask what they can do here, explain that they can record speeches, get honest feedback, practice with generated speeches, generate audio, save/review history, track progress, manage their account, customize Aawax, and ask you for guidance.
Answer user questions about the app, public speaking, practice speeches, feedback, history, progress, account settings, and voice/audio features.
Be concise, friendly, practical, and specific. Keep answers under 140 words unless the user asks for detail.
Do not claim you changed app data, deleted files, recorded audio, or performed actions. If the user asks for account/security-sensitive help, explain safely and suggest using the visible app controls.
Current app tab: ${tab}.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 260,
        temperature: 0.55,
      }),
    }, 0, 0, 60000).catch(() => null);

    if (!res) {
      return Response.json({ answer: '', error: 'Aawax is temporarily unavailable. Please ask again in a moment.' }, { status: 503 });
    }

    const data = await res.json().catch(() => ({})) as ChatCompletionData;
    const status = res.ok ? 502 : res.status;
    const providerMessage = getProviderErrorMessage(data);

    if (data.error || !res.ok) {
      return Response.json({ answer: '', error: formatAawaxError(status, providerMessage) }, { status });
    }

    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return Response.json({ answer: '', error: 'Aawax returned an empty answer. Please ask again.' }, { status: 502 });
    }

    return Response.json({ answer });
  } catch (error) {
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }
    if (error instanceof IdentityError) {
      return identityErrorResponse();
    }

    return Response.json(
      { answer: '', error: isAbortTimeout(error) ? 'Aawax timed out. Please ask a shorter question.' : 'Aawax failed to answer. Please try again.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 120;
