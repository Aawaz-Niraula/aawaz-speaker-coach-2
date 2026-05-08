import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!topic || topic.trim().length < 3) {
    return Response.json({ speech: '', error: 'Please enter a valid topic.' });
  }

  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

  if (!DEEPINFRA_API_KEY) {
    return Response.json({ speech: '', error: 'Server configuration error: missing API key.' });
  }

  const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistralai/Mistral-Small-24B-Instruct-2501',
      messages: [
        {
          role: 'system',
          content: `You are a professional speechwriter. Write clear, engaging, well-structured speeches suitable for students and professionals to practice public speaking.`,
        },
        {
          role: 'user',
          content: `Write a 60–90 second public speaking sample speech on the topic: "${topic}".
          
Requirements:
- 150–200 words
- Clear opening, 2–3 key points, strong closing
- Natural spoken language, not too formal
- No stage directions or labels, just the speech text itself`,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (data.error || !res.ok) {
    return Response.json({ speech: '', error: data.error?.message || 'Failed to generate speech script.' });
  }

  const speech = data.choices?.[0]?.message?.content || '';
  return Response.json({ speech });
}

export const runtime = 'edge';
export const maxDuration = 300;
