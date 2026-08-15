import { randomUUID } from 'crypto';
import { after, NextRequest } from 'next/server';

import { getProviderErrorMessage, isAbortTimeout, isProviderUnavailable, type ChatCompletionData } from '@/lib/ai';
import { GuestLimitError, IdentityError, guestLimitResponse, identityErrorResponse, resolveAppUser } from '@/lib/app-user';
import { insertGeneratedSpeech } from '@/lib/db';
import { fetchWithRetryLimited } from '@/lib/fetch';
import { requireSameOrigin } from '@/lib/identity';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { formatSchemeForPrompt, getScoringScheme } from '@/lib/scoring';
import { formatCueListForPrompt } from '@/lib/elevenlabs';
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

/**
 * Cleans up what the writer returns.
 *
 * Prompting alone does not reliably stop a model emitting a markdown title,
 * bullet points, or running well past the requested length, so the obvious
 * document furniture is stripped here and the text is trimmed to the target
 * at a paragraph boundary. Delivery cues are preserved throughout.
 */
function tidySpeech(raw: string, maxWords: number) {
  let text = raw.trim();

  // Markdown title or a leading "Speech:" label.
  text = text.replace(/^\s*(?:\*\*|##+\s*)?(?:speech|script|title)\s*[:*]*\s*\n+/i, '');
  text = text.replace(/^\s*\*\*[^\n*]{0,60}\*\*\s*\n+/, '');

  const lines = text.split('\n').map((line) => line
    // Bullets and numbered list markers: a speaker cannot say these.
    .replace(/^\s*[-–—•*]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    // Leading indentation the model sometimes adds for emphasis.
    .replace(/^\s{2,}/, ''));

  text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Trim to length at a paragraph boundary rather than mid-sentence.
  const countWords = (value: string) => value.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean).length;
  if (countWords(text) > maxWords) {
    const paragraphs = text.split(/\n{2,}/);
    const kept: string[] = [];
    let total = 0;
    for (const paragraph of paragraphs) {
      const words = countWords(paragraph);
      if (kept.length && total + words > maxWords) break;
      kept.push(paragraph);
      total += words;
    }
    if (kept.length) text = kept.join('\n\n');
  }

  return text.trim();
}

export async function POST(req: NextRequest) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json().catch(() => null);
    const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 180) : '';
    const templateId = typeof body?.templateId === 'string' ? body.templateId.trim().slice(0, 80) : '';
    const template = getSpeechTemplate(templateId || null);
    // The same marking scheme the coach will grade against, so the writer aims
    // at the actual target rather than a general idea of "good".
    const schemeSection = formatSchemeForPrompt(getScoringScheme(template?.id ?? null));
    // The exact cue vocabulary the translator understands. Generated from the
    // same table, so the writer cannot be told about a cue that would later be
    // stripped, or miss one that is legal.
    const cueList = formatCueListForPrompt();
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
              content: `You are a professional speechwriter who writes for the ear, not the page.

The result must read as a speech someone is about to deliver, not an essay about the topic. Short sentences that can be said in one breath. Direct address to the room. Concrete images over abstractions. Rhetorical devices that land aloud: the rule of three, the callback, the deliberate repetition.

Every speech is written to a named format and graded against that format's marking scheme. You are given the scheme. Write so the speech would earn near-full marks on every criterion — hit each one deliberately rather than hoping it emerges.

You also mark the speech for performance. Insert delivery cues inline so the speaker knows how to say it, not merely what to say.`,
            },
            {
              role: 'user',
              content: `Write a practice speech on the topic: "${topic}" in the "${template?.label ?? 'General Public Speaking'}" format${template ? ` (${template.rubricTitle})` : ''}.

The speech will be judged against this exact rubric, so it must satisfy every rule:
${template?.rubric ?? ''}

It will also be marked against this scheme. Write it to score near full marks on every criterion:
${schemeSection}

LENGTH — this is a hard limit.
Write between ${lowerWordCount} and ${upperWordCount} spoken words. Delivery cues in brackets do not count. Count as you write and stop when you reach the range: a speech that runs over is wrong however good it is, because the speaker has a time slot.

DELIVERY CUES — required, and this list is exhaustive.
Mark the speech for performance using inline cues in square brackets, so it reads like a script rather than a paragraph.

You may ONLY use these cues, spelled exactly as written:

${cueList}

Rules for cues:
- Use ONLY the cues listed above. Any other bracketed text is invalid: do not invent cues such as [dramatic], [narratively], [pauses 2 seconds] or [gestures]. There are no other legal cues and anything else will be discarded.
- Copy the wording exactly. [pause] is valid; [Pause for effect] is not.
- Roughly one cue every two or three sentences. Enough to shape the delivery, not so many that the text is unreadable.
- Place them where they change something. A cue on every sentence is noise.
- Never put two cues in a row.
- Cues sit inline in the text, in square brackets, on the same line as the words.

FORMATTING — this is spoken text, not a document.
- Short paragraphs separated by blank lines, the way a speaker sees a script.
- Every line is words the speaker says out loud.
- NO bullet points, dashes, numbered lists, headings, section labels, or indentation. A speaker cannot say a bullet point.
- No stage directions beyond the delivery cues listed above.
- Do not label the format's sections. The structure should be audible, not announced.`,
            },
          ],
          // Extra headroom: delivery cues add tokens without adding words.
          max_tokens: Math.ceil(targetWordCount * 3.2),
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
        // Strip document furniture and hold the length the user asked for.
        const trimmed = tidySpeech(speech, upperWordCount + 25);
        const speechId = randomUUID();

        // Saved in the background: a storage failure must not cost the user
        // the script they just waited for.
        after(async () => {
          try {
            await insertGeneratedSpeech({
              id: speechId,
              user_id: userId,
              topic,
              template_id: template?.id ?? null,
              template_label: template?.label ?? null,
              word_count: trimmed.split(/\s+/).filter(Boolean).length,
              speech: trimmed,
            });
          } catch (e) {
            console.error('Failed to save generated speech in background:', e);
          }
        });

        return Response.json({ speech: trimmed, speechId, isGuest, guestRemaining });
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
