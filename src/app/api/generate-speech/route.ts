import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!topic || topic.trim().length < 3) {
    return Response.json({ speech: '', error: 'Please enter a valid topic.' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

  const data = await res.json();

  if (data.error) {
    return Response.json({ speech: '', error: data.error.message });
  }

  const speech = data.choices?.[0]?.message?.content || '';
  return Response.json({ speech });
}

export const runtime = 'edge';
