export type ParsedFeedback = {
  analysisItems: { label: string; value: string }[];
  score: number | null;
  brutalFeedback: string;
  /** Per-criterion marks from the marking scheme, e.g. "Pausing: 5/7". */
  markBreakdown: { label: string; value: string }[];
  fixes: string[];
  rawText: string;
};

export function extractScore(text: string) {
  // "Overall score" on the standard report, "Delivery score" on the deep one.
  const match = text.match(/(?:overall|delivery) score[:\s-]*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

/**
 * Parses either report shape.
 *
 * The standard analysis and the deep delivery report use different headings,
 * so every pattern here accepts both. Older saved reports used "BRUTALLY
 * HONEST FEEDBACK" and still parse.
 */
export function parseFeedback(text: string): ParsedFeedback {
  const score = extractScore(text);

  const analysisItems: { label: string; value: string }[] = [];
  const analysisMatch = text.match(
    /(?:📊|🎧)?\s*(?:DELIVERY\s+)?ANALYSIS[:\s]*\n([\s\S]*?)(?=\n(?:📐|🔥|🎯|MARK BREAKDOWN|BRUTALLY|HONEST|WHAT YOUR VOICE)|$)/i,
  );
  if (analysisMatch) {
    const lines = analysisMatch[1].split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const label = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        // Both score labels are rendered in the ring instead of the list.
        if (/^(overall|delivery) score$/i.test(label)) continue;
        analysisItems.push({ label, value });
      }
    }
  }

  /* Marking scheme breakdown. Shows how the total was arrived at, so a score
     can be explained rather than taken on trust. */
  const markBreakdown: { label: string; value: string }[] = [];
  const breakdownMatch = text.match(/(?:📐\s*)?MARK BREAKDOWN[:\s]*\n([\s\S]*?)(?=\n(?:🔥|🎯|⚠|HONEST|WHAT YOUR VOICE|In every row)|$)/i);
  if (breakdownMatch) {
    for (const line of breakdownMatch[1].split('\n')) {
      const row = line.replace(/^[•\-*]\s*/, '').trim();
      const idx = row.lastIndexOf(':');
      if (idx > 0 && /\d+\s*\/\s*\d+/.test(row.slice(idx))) {
        const label = row.slice(0, idx).trim();
        /* The model closes the breakdown with its own "Total: 84/100". That is
           a summary of the rows, not a criterion, and counting it as one made
           the row count exceed the scheme — which made totalFromBreakdown
           reject every breakdown and silently stop correcting scores. */
        if (/^total$/i.test(label)) continue;
        markBreakdown.push({ label, value: row.slice(idx + 1).trim() });
      }
    }
  }

  let brutalFeedback = '';
  const bodyMatch = text.match(
    /(?:🔥\s*)?(?:BRUTALLY\s+)?HONEST FEEDBACK[:\s]*\n([\s\S]*?)(?=\n(?:🛠|3 SPECIFIC)|$)/i,
  );
  if (bodyMatch) {
    brutalFeedback = bodyMatch[1].trim();
  } else {
    // Deep report: the prose is split across a strengths and a weaknesses
    // section. Join them so the card shows the whole picture.
    const good = text.match(/(?:🎯\s*)?WHAT YOUR VOICE DID WELL[:\s]*\n([\s\S]*?)(?=\n(?:⚠️?|WHAT HELD|🎤|3 DELIVERY)|$)/i);
    const bad = text.match(/(?:⚠️?\s*)?WHAT HELD IT BACK[:\s]*\n([\s\S]*?)(?=\n(?:🎤|3 DELIVERY)|$)/i);
    brutalFeedback = [good?.[1]?.trim(), bad?.[1]?.trim()].filter(Boolean).join('\n\n');
  }

  const fixes: string[] = [];
  const fixesMatch = text.match(/(?:🛠️?|🎤)?\s*3 (?:SPECIFIC FIXES|DELIVERY DRILLS)[:\s]*\n([\s\S]*?)$/i);
  if (fixesMatch) {
    const fixLines = fixesMatch[1]
      .split('\n')
      // Drop the bracketed instruction line the model sometimes echoes back.
      .filter((l) => !/^\s*\[/.test(l))
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    fixes.push(...fixLines.slice(0, 3));
  }

  return { analysisItems, score, brutalFeedback, markBreakdown, fixes, rawText: text };
}

/** Bands mirror the scoring rules sent to the coach in the analysis prompt. */
export function scoreGrade(score: number) {
  if (score >= 90) return { label: 'Exceptional', tone: 'Stage-ready. Hold this standard.' };
  if (score >= 80) return { label: 'Commanding', tone: 'Strong work. Sharpen the last edges.' };
  if (score >= 70) return { label: 'Strong', tone: 'Solid control. Tighten the weak spots.' };
  if (score >= 55) return { label: 'Competent', tone: 'It works. Now make it consistent.' };
  if (score >= 40) return { label: 'Developing', tone: 'The bones are there. Drill the fixes.' };
  if (score >= 25) return { label: 'Rough', tone: 'Structure first. Then everything else.' };
  return { label: 'Early Days', tone: 'Every speaker starts here. Run the fixes.' };
}

export function scoreColor(score: number) {
  return score >= 70 ? '#a78bfa' : score >= 45 ? '#facc15' : '#f87171';
}

export function formatHistoryDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
