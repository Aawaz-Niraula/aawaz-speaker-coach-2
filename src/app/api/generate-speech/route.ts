import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 180) : '';
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

    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: 'mistralai/Mistral-Small-24B-Instruct-2501',
        messages: [
          {
            role: 'system',
            content: 'You are a professional speechwriter. Write clear, engaging, well-structured speeches suitable for students and professionals to practice public speaking.',
          },
          {
            role: 'user',
            content: `Write a public speaking sample speech on the topic: "${topic}".

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
    });

    const data = await res.json().catch(() => ({}));

    if (data.error || !res.ok) {
      return Response.json(
        { speech: '', error: data.error?.message || 'Failed to generate speech script.' },
        { status: res.ok ? 502 : res.status },
      );
    }

    const speech = data.choices?.[0]?.message?.content || '';
    return Response.json({ speech });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    return Response.json(
      { speech: '', error: isTimeout ? 'Speech generation timed out. Please try a shorter speech or try again.' : 'Speech generation failed. Please try again.' },
      { status: 503 },
    );
  }
}

export const runtime = 'edge';
export const maxDuration = 300;
