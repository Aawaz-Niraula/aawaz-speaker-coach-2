import { NextRequest } from 'next/server';

import { getProviderErrorMessage, isAbortTimeout, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { listRecentSpeechSessions } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const INSIGHT_MODELS = [
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'Qwen/Qwen3.5-9B',
] as const;

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const { userId } = await resolveAppUser(req, true);
    const rateKey = `generate-insights:${getClientKey(req, userId)}`;
    const rateLimit = checkRateLimit(rateKey, 15, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many insight requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const globalRateLimit = checkRateLimit('global:generate-insights', 120, 5 * 60 * 1000);
    if (!globalRateLimit.allowed) {
      return Response.json(
        { error: 'Insight generation is busy right now. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': String(globalRateLimit.retryAfterSeconds) } },
      );
    }

    const sessions = await listRecentSpeechSessions(userId, 12);

    if (!sessions || sessions.length === 0) {
      return Response.json({
        insights: ['No sessions yet. Record your first speech to see insights.'],
        weaknesses: ['Complete at least one speech session to identify areas for improvement.'],
      });
    }

    const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

    if (!DEEPINFRA_API_KEY) {
      return Response.json({ error: 'Server configuration error: missing API key.' }, { status: 500 });
    }

    // Pre-compute stats on the server to reduce LLM work
    const scored = sessions.filter((s) => s.overall_score !== null);
    const scores = scored.map((s) => s.overall_score as number);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const wpms = sessions.map((s) => s.words_per_min).filter((w): w is number => w !== null);
    const avgWpm = wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : null;

    // Group scores by mode
    const modeScores: Record<string, number[]> = {};
    for (const s of scored) {
      const mode = s.template_label || 'General';
      (modeScores[mode] ??= []).push(s.overall_score as number);
    }
    const modeAvgs = Object.entries(modeScores).map(([mode, vals]) => `${mode}: ${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}/100 (${vals.length} sessions)`).join(', ');

    // Compact session lines — only key data + condensed feedback keywords
    const sessionLines = sessions.slice(0, 10).map((s, i) => {
      const label = s.template_label || 'General';
      const score = s.overall_score ?? '-';
      const wpm = s.words_per_min ?? '-';
      const fb = s.feedback.slice(0, 150).replace(/\n/g, ' ');
      return `${i + 1}. ${label} | ${score}/100 | ${wpm}wpm | ${fb}`;
    }).join('\n');

    let data: ChatCompletionData = {};
    let lastStatus = 503;
    let lastMessage = 'Failed to generate insights.';
    let succeeded = false;

    for (const model of INSIGHT_MODELS) {
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
              content: `Reply ONLY with valid JSON: {"insights":["..."],"weaknesses":["..."]}. 3 insights (factual, with numbers), 2 weaknesses (concrete issues). No markdown.`,
            },
            {
              role: 'user',
              content: `${sessions.length} sessions. Avg score: ${avgScore ?? 'N/A'}/100, Avg WPM: ${avgWpm ?? 'N/A'}. By mode: ${modeAvgs}. First score: ${scores[scores.length - 1] ?? '-'}, Latest: ${scores[0] ?? '-'}.\n\n${sessionLines}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.2,
        }),
      }, 0, 0, 75000).catch(() => null);

      if (!res) {
        lastStatus = 503;
        lastMessage = 'Insight generation is temporarily unavailable. Please try again in a little while.';

        if (model !== INSIGHT_MODELS[INSIGHT_MODELS.length - 1]) {
          continue;
        }

        break;
      }

      data = await res.json().catch(() => ({})) as ChatCompletionData;
      lastStatus = res.ok ? 502 : res.status;
      lastMessage = getProviderErrorMessage(data) || lastMessage;

      if (data.error || !res.ok) {
        if (isProviderUnavailable(lastStatus, lastMessage) && model !== INSIGHT_MODELS[INSIGHT_MODELS.length - 1]) {
          continue;
        }

        break;
      }

      succeeded = true;
      break;
    }

    if (!succeeded) {
      return Response.json(
        { error: lastStatus === 429 ? "Today's free AI limit has been reached. Please try again later." : lastMessage },
        { status: lastStatus },
      );
    }

    const raw = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      return Response.json({
        insights: Array.isArray(parsed.insights) ? parsed.insights : ['No insights available.'],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ['No weaknesses identified.'],
      });
    } catch {
      return Response.json({
        insights: [raw || 'Could not parse insights.'],
        weaknesses: ['Could not parse weaknesses.'],
      });
    }
  } catch (error) {
    if (error instanceof GuestLimitError) {
      return guestLimitResponse();
    }
    if (error instanceof IdentityError) {
      return identityErrorResponse();
    }

    return Response.json(
      { error: isAbortTimeout(error) ? 'Insight generation timed out. Please try again.' : 'Insight generation failed.' },
      { status: 503 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
