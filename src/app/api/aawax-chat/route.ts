import { NextRequest } from 'next/server';

import { getProviderErrorMessage, isAbortTimeout, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { listRecentSpeechSessions, type SpeechSessionRecord } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const AAWAX_MODEL = process.env.DEEPINFRA_AAWAX_MODEL || 'deepseek-ai/DeepSeek-V4-Flash';

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

function formatAawaxError(status: number, message?: string) {
  if (status === 429) {
    return "Aawax's daily AI limit has been reached. Please try again later.";
  }

  if (isProviderUnavailable(status, message)) {
    return 'Aawax is temporarily busy. Please ask again in a moment.';
  }

  return message || 'Aawax could not answer right now.';
}

/** Strip any chain-of-thought the model may leak — we run in quick mode only. */
function stripReasoning(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

function firstSentence(feedback: string, max = 90) {
  const clean = feedback.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

/** Build a compact, private summary of the user's speaking history for the model. */
function buildPerformanceContext(sessions: SpeechSessionRecord[]) {
  if (!sessions.length) {
    return 'PERFORMANCE DATA: The user has no recorded speeches yet. Gently encourage them to record their first speech in the Speaking Coach tab.';
  }

  const scored = sessions.filter((s) => typeof s.overall_score === 'number');
  const chronological = [...scored].reverse(); // oldest -> newest

  const lines: string[] = [`PERFORMANCE DATA (private to this user, ${sessions.length} recent session${sessions.length === 1 ? '' : 's'}):`];

  if (scored.length) {
    const scores = scored.map((s) => s.overall_score as number);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = Math.max(...scores);
    const latest = chronological[chronological.length - 1].overall_score as number;
    const first = chronological[0].overall_score as number;
    const trend = chronological.length > 1 ? latest - first : 0;
    const trendWord = trend > 2 ? `improving (+${trend})` : trend < -2 ? `slipping (${trend})` : 'fairly steady';

    const wpmValues = scored.map((s) => s.words_per_min).filter((v): v is number => typeof v === 'number');
    const avgWpm = wpmValues.length ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length) : null;

    lines.push(`- Latest score: ${latest}/100. Average: ${avg}/100. Best: ${best}/100. Trend: ${trendWord}.`);
    if (avgWpm) lines.push(`- Average pace: ${avgWpm} words/min${avgWpm > 170 ? ' (a bit fast)' : avgWpm < 110 ? ' (a bit slow)' : ' (good range)'}.`);

    // Weak rubrics: group by template/rubric, average, weakest first.
    const byRubric = new Map<string, number[]>();
    for (const s of scored) {
      const key = s.template_label || 'General';
      const arr = byRubric.get(key) ?? [];
      arr.push(s.overall_score as number);
      byRubric.set(key, arr);
    }
    const rubricAverages = [...byRubric.entries()]
      .map(([label, arr]) => ({ label, avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), count: arr.length }))
      .sort((a, b) => a.avg - b.avg);
    if (rubricAverages.length) {
      const weakest = rubricAverages[0];
      const strongest = rubricAverages[rubricAverages.length - 1];
      lines.push(`- Weakest rubric: ${weakest.label} (avg ${weakest.avg}/100). Strongest: ${strongest.label} (avg ${strongest.avg}/100).`);
    }
  } else {
    lines.push('- Sessions exist but none have a numeric score yet.');
  }

  const recent = sessions.slice(0, 6).map((s, i) => {
    const label = s.template_label || 'General';
    const score = typeof s.overall_score === 'number' ? `${s.overall_score}/100` : 'n/a';
    const note = s.feedback ? ` — ${firstSentence(s.feedback)}` : '';
    return `  ${i + 1}. ${label} | ${score}${note}`;
  });
  lines.push('- Recent sessions (newest first):', ...recent);

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 900) : '';
    const tab = typeof body?.tab === 'string' ? body.tab.trim().slice(0, 40) : 'coach';
    const history: IncomingMessage[] = Array.isArray(body?.history)
      ? body.history
          .filter((m: unknown): m is IncomingMessage =>
            !!m && typeof m === 'object' &&
            ((m as IncomingMessage).role === 'user' || (m as IncomingMessage).role === 'assistant') &&
            typeof (m as IncomingMessage).content === 'string',
          )
          .slice(-10)
          .map((m: IncomingMessage) => ({ role: m.role, content: m.content.slice(0, 900) }))
      : [];

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

    const sessions = await listRecentSpeechSessions(userId, 25).catch(() => [] as SpeechSessionRecord[]);
    const performanceContext = buildPerformanceContext(sessions);

    const conversation = history.length
      ? history
      : [{ role: 'user' as const, content: message }];
    // Ensure the latest user message is present and last.
    if (!history.length || conversation[conversation.length - 1]?.content !== message) {
      conversation.push({ role: 'user', content: message });
    }

    const res = await fetchWithRetryLimited('chat', 'https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AAWAX_MODEL,
        // Quick mode only — no reasoning/thinking for DeepSeek hybrid models.
        chat_template_kwargs: { thinking: false },
        reasoning_effort: 'none',
        messages: [
          {
            role: 'system',
            content: `You are Aawax, the warm, encouraging, and genuinely caring AI speaking companion inside Aawaz Speaker Coach. Your creator is Aawaz. You speak like a kind friend and coach: warm, supportive, upbeat, and human — never cold or robotic. Use light, natural warmth (an occasional gentle emoji like 🙂 or ✨ is fine, but do not overdo it).

You know the app's features: Speaking Coach (record a speech, get honest AI feedback), rubric/template selection (including Monroe's Motivated Sequence), Speech Practice (generate practice scripts and hear them in example or your own cloned voice), Speech History, Progress insights, Account, avatar profile, the Aawax customizer, the guided tour, and help controls.

You have access to this user's private speaking history below. Use it to make your answers personal and specific. When they ask how they're doing, what to improve, or about their weak areas, reference their real numbers, their weakest rubric, and their trend. Give concrete, tailored, encouraging improvement tips they can act on next session. If they have no history yet, warmly nudge them to record their first speech.

${performanceContext}

Rules:
- Be warm, concise, and practical. Default to under 140 words unless they ask for more detail.
- Never invent scores or data that isn't in the performance summary. If something isn't there, say so kindly.
- Do not claim you performed actions (recording, deleting, changing settings). Point them to the visible app controls instead.
- Keep it positive even when feedback is critical — frame weaknesses as the next thing to practice.
Current app tab: ${tab}.`,
          },
          ...conversation,
        ],
        max_tokens: 320,
        temperature: 0.6,
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

    const answer = stripReasoning(data.choices?.[0]?.message?.content?.trim() || '');
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
