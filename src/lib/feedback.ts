export type ParsedFeedback = {
  analysisItems: { label: string; value: string }[];
  score: number | null;
  brutalFeedback: string;
  fixes: string[];
  rawText: string;
};

export function extractScore(text: string) {
  const match = text.match(/overall score[:\s-]*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

export function parseFeedback(text: string): ParsedFeedback {
  const score = extractScore(text);

  const analysisItems: { label: string; value: string }[] = [];
  const analysisMatch = text.match(/(?:📊\s*)?ANALYSIS[:\s]*\n([\s\S]*?)(?=\n(?:🔥|BRUTALLY)|$)/i);
  if (analysisMatch) {
    const lines = analysisMatch[1].split('\n').map((l) => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const label = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (label.toLowerCase().includes('overall score')) continue; // shown in ring
        analysisItems.push({ label, value });
      }
    }
  }

  let brutalFeedback = '';
  const brutalMatch = text.match(/(?:🔥\s*)?BRUTALLY HONEST FEEDBACK[:\s]*\n([\s\S]*?)(?=\n(?:🛠|3 SPECIFIC|$))/i);
  if (brutalMatch) brutalFeedback = brutalMatch[1].trim();

  const fixes: string[] = [];
  const fixesMatch = text.match(/(?:🛠️?\s*)?3 SPECIFIC FIXES[:\s]*\n([\s\S]*?)$/i);
  if (fixesMatch) {
    const fixLines = fixesMatch[1].split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    fixes.push(...fixLines.slice(0, 3));
  }

  return { analysisItems, score, brutalFeedback, fixes, rawText: text };
}

export function scoreGrade(score: number) {
  if (score >= 85) return { label: 'Commanding', tone: 'Stage-ready. Keep this standard.' };
  if (score >= 70) return { label: 'Strong', tone: 'Solid control. Sharpen the edges.' };
  if (score >= 55) return { label: 'Developing', tone: 'The bones are there. Drill the fixes.' };
  if (score >= 40) return { label: 'Rough', tone: 'Structure first. Then everything else.' };
  return { label: 'Needs Work', tone: 'Honest start. The only way is up.' };
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
