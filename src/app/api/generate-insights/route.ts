import { NextRequest } from 'next/server';

import { listRecentSpeechSessions } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 128) : '';

    if (!userId) {
      return Response.json({ error: 'Missing userId.' }, { status: 400 });
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

    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: 'mistralai/Mistral-Small-24B-Instruct-2501',
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
    });

    const data = await res.json().catch(() => ({}));

    if (data.error || !res.ok) {
      return Response.json(
        { error: data.error?.message || 'Failed to generate insights.' },
        { status: res.ok ? 502 : res.status },
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
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    return Response.json(
      { error: isTimeout ? 'Insight generation timed out. Please try again.' : 'Insight generation failed.' },
      { status: 503 },
    );
  }
}

export const runtime = 'edge';
export const maxDuration = 300;
