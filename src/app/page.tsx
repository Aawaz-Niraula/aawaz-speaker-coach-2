'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Download,
  MessageCircleMore,
  Plus,
  Play,
  Volume2,
  Menu,
  Mic,
  MicOff,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  WandSparkles,
  X,
} from 'lucide-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { toast, Toaster } from 'sonner';

import { Button } from '@/components/ui/button';
import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';
import { cn } from '@/lib/utils';

type Tab = 'coach' | 'speech' | 'history' | 'progress';
type NavItem = { id: Tab; label: string; icon: typeof Mic };
type SpeechHistoryItem = {
  id: string;
  created_at: string;
  template_label: string | null;
  overall_score: number | null;
  words_per_min: number | null;
  transcript: string;
  feedback: string;
};
type HistoryResponse = { history?: SpeechHistoryItem[] };
type AnalyzeResponse = HistoryResponse & { transcript?: string; feedback?: string; voiceSampleSaved?: boolean };
type SpeechResponse = { speech?: string };
type InsightsResponse = { insights?: string[]; weaknesses?: string[] };
type SpeechAudioMode = 'example' | 'clone';
type SpeechExampleVoice = 'female' | 'male';
type SpeechAudioState = {
  example: { url: string; isLoading: boolean };
  clone: { url: string; isLoading: boolean };
};

const navItems: NavItem[] = [
  { id: 'coach', label: 'Speaking Coach', icon: Mic },
  { id: 'speech', label: 'Speech Practice', icon: WandSparkles },
  { id: 'history', label: 'Speech History', icon: Trophy },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
];

const MAX_RECORDING_SECONDS = 300;
const VOICE_SAMPLE_SECONDS = 10;

function ProgressChart({ history }: { history: SpeechHistoryItem[] }) {
  const scored = history
    .filter((h) => h.overall_score !== null)
    .slice()
    .reverse();
  if (scored.length < 1) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[24px] border border-dashed border-white/20 bg-white/4 font-mono text-sm text-[#857ca2]">
        Record at least one speech to see your progress chart.
      </div>
    );
  }

  const scores = scored.map((h) => h.overall_score as number);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const W = 600;
  const H = 200;
  const padX = 42;
  const padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const points = scores.map((s, i) => {
    const x = padX + (scores.length === 1 ? chartW / 2 : (i / (scores.length - 1)) * chartW);
    const y = padY + chartH - ((s - minScore) / range) * chartH;
    return { x, y, score: s, label: scored[i].template_label || 'General' };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round(minScore + (range / gridLines) * i),
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
      </defs>
      {gridValues.map((v) => {
        const gy = padY + chartH - ((v - minScore) / range) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padX - 6} y={gy + 4} textAnchor="end" fill="#857ca2" fontSize="10" fontFamily="monospace">{v}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="#0b0b12" stroke="#a78bfa" strokeWidth="2" />
          <circle cx={p.x} cy={p.y} r="2.5" fill="#a78bfa" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#ddd6fe" fontSize="10" fontFamily="monospace">{p.score}</text>
        </g>
      ))}
    </svg>
  );
}

function usePersistentUserId() {
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'aawaz-user-id';
    const nextId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `user-${Date.now()}`;

    try {
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      window.localStorage.setItem(key, nextId);
    } catch {
      return nextId;
    }

    return nextId;
  });
  return userId;
}

function extractScore(text: string) {
  const match = text.match(/overall score[:\s-]*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

function formatHistoryDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 90000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Request failed.');
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function Shell({ children, className: extra }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-[24px] border border-white/10 bg-white/6 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:rounded-[28px] sm:p-6', extra)}>{children}</div>;
}

/* ── Animated Score Ring ─────────────────────────────────────────── */
function AnimatedScore({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(ease * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const color = value >= 70 ? '#a78bfa' : value >= 45 ? '#facc15' : '#f87171';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="relative mx-auto flex flex-col items-center gap-2"
    >
      <div className="h-32 w-32 sm:h-36 sm:w-36">
        <CircularProgressbar
          value={displayed}
          text={`${displayed}`}
          styles={buildStyles({
            textSize: '24px',
            textColor: '#f2efff',
            pathColor: color,
            trailColor: 'rgba(255,255,255,0.06)',
            pathTransitionDuration: 0,
          })}
        />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#857ca2]">out of 100</span>
    </motion.div>
  );
}

/* ── Feedback Parser ─────────────────────────────────────────────── */
type ParsedFeedback = {
  analysisItems: { label: string; value: string }[];
  score: number | null;
  brutalFeedback: string;
  fixes: string[];
  rawText: string;
};

function parseFeedback(text: string): ParsedFeedback {
  const score = extractScore(text);

  // Extract ANALYSIS section
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

  // Extract BRUTALLY HONEST FEEDBACK
  let brutalFeedback = '';
  const brutalMatch = text.match(/(?:🔥\s*)?BRUTALLY HONEST FEEDBACK[:\s]*\n([\s\S]*?)(?=\n(?:🛠|3 SPECIFIC|$))/i);
  if (brutalMatch) brutalFeedback = brutalMatch[1].trim();

  // Extract 3 SPECIFIC FIXES
  const fixes: string[] = [];
  const fixesMatch = text.match(/(?:🛠️?\s*)?3 SPECIFIC FIXES[:\s]*\n([\s\S]*?)$/i);
  if (fixesMatch) {
    const fixLines = fixesMatch[1].split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    fixes.push(...fixLines.slice(0, 3));
  }

  return { analysisItems, score, brutalFeedback, fixes, rawText: text };
}

/* ── ELP Explainer Popup ─────────────────────────────────────────── */
function ELPPopup({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close ELP explainer"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto max-h-[80vh] rounded-[24px] border border-white/10 bg-[#0b0b12]/95 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.7)] backdrop-blur-xl sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="font-serif text-xl font-medium tracking-tight text-white sm:text-2xl">ELP Framework</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f87171]/30 bg-[#dc2626]/15 text-[#f87171] hover:bg-[#dc2626]/25"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#857ca2]">Ethos · Logos · Pathos — the three pillars of persuasive speaking.</p>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[18px] border border-white/10 bg-white/4 p-4 sm:rounded-[22px]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a78bfa]">Ethos — Credibility</div>
            <p className="mt-2 text-sm leading-relaxed text-[#f2efff]">Establish why the audience should trust you on this topic. Share first-hand experience, qualifications, or deep personal understanding.</p>
            <p className="mt-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-[13px] italic leading-relaxed text-[#ddd6fe]">&quot;I grew up in a family that lived below the poverty line — I don&apos;t speak about poverty from a textbook, I speak from memory. I know the weight of choosing between food and medicine.&quot;</p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/4 p-4 sm:rounded-[22px]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a78bfa]">Logos — Logic</div>
            <p className="mt-2 text-sm leading-relaxed text-[#f2efff]">Build your case with facts, statistics, data, and logical reasoning that make the argument intellectually undeniable.</p>
            <p className="mt-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-[13px] italic leading-relaxed text-[#ddd6fe]">&quot;According to the World Bank, roughly 700 million people still live on less than $2.15 a day. UNICEF reports that 5.2 million children under five died in 2019 — many from preventable causes directly linked to poverty.&quot;</p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/4 p-4 sm:rounded-[22px]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f9a8d4]">Pathos — Emotion</div>
            <p className="mt-2 text-sm leading-relaxed text-[#f2efff]">Create genuine emotional resonance. Paint vivid, visceral imagery that moves the audience to feel the weight of your message.</p>
            <p className="mt-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-[13px] italic leading-relaxed text-[#ddd6fe]">&quot;Imagine a mother who loves her child more than life itself — but can do nothing but watch that child perish from a treatable disease, because she cannot afford the medication. That is not a scene from a dystopian film. That is reality for millions, right now, as we speak.&quot;</p>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Text renderer that makes ELP clickable ──────────────────────── */
function renderWithELP(text: string, onClickELP: () => void): React.ReactNode {
  const parts = text.split(/(ELP)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part === 'ELP' ? (
      <button
        key={i}
        type="button"
        onClick={onClickELP}
        className="inline font-semibold text-[#a78bfa] underline decoration-[#a78bfa]/40 underline-offset-2 transition hover:text-[#ddd6fe] hover:decoration-[#ddd6fe]/60"
      >
        ELP
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/* ── Feedback Display ────────────────────────────────────────────── */
function FeedbackDisplay({
  feedback,
  copyText,
  speakText,
}: {
  feedback: string;
  copyText: (v: string, l: string) => void;
  speakText: (v: string, l: string) => void;
}) {
  const parsed = useMemo(() => parseFeedback(feedback), [feedback]);
  const hasSections = parsed.analysisItems.length > 0 || parsed.brutalFeedback || parsed.fixes.length > 0;
  const [elpOpen, setElpOpen] = useState(false);
  const openELP = () => setElpOpen(true);

  if (!hasSections) {
    // Fallback: render raw text if parsing fails
    return (
      <Shell>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Coach Verdict</p>
        <p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{renderWithELP(feedback, openELP)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(feedback, 'Feedback')}><Copy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(feedback, 'Feedback')}><Volume2 className="h-4 w-4" /></Button>
        </div>
        <AnimatePresence>{elpOpen && <ELPPopup onClose={() => setElpOpen(false)} />}</AnimatePresence>
      </Shell>
    );
  }

  return (
    <div className="grid gap-5">
      <AnimatePresence>{elpOpen && <ELPPopup onClose={() => setElpOpen(false)} />}</AnimatePresence>

      {/* ── Score Ring ────────────────────────────────────── */}
      {parsed.score !== null && (
        <Shell className="border-[#a78bfa]/20 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(249,168,212,0.06))]">
          <p className="mb-4 text-center font-serif text-lg font-medium tracking-tight text-white sm:text-xl">Overall Score</p>
          <AnimatedScore value={parsed.score} />
        </Shell>
      )}

      {/* ── Analysis Metrics ─────────────────────────────── */}
      {parsed.analysisItems.length > 0 && (
        <Shell>
          <p className="mb-4 font-serif text-lg font-medium tracking-tight text-white sm:text-xl">Analysis</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {parsed.analysisItems.map((item, i) => {
              const isStructure = item.label.toLowerCase().includes('structure');
              const structureBullets = isStructure ? item.value.split(/[.;]/).map((s) => s.trim()).filter(Boolean) : [];
              return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn('rounded-[18px] border border-white/10 bg-[#0b0b12]/50 p-4 sm:rounded-[22px]', isStructure && 'sm:col-span-2')}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ddd6fe] sm:text-sm">{item.label}</div>
                {isStructure && structureBullets.length > 1 ? (
                  <ul className="mt-3 grid gap-2">
                    {structureBullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]">
                        <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#a78bfa]"></span>
                        {renderWithELP(b, openELP)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm font-medium text-[#f2efff] sm:text-base">{renderWithELP(item.value, openELP)}</div>
                )}
              </motion.div>
              );
            })}
          </div>
        </Shell>
      )}

      {/* ── Brutal Feedback ───────────────────────────────── */}
      {parsed.brutalFeedback && (
        <Shell className="border-[#f87171]/15">
          <p className="mb-3 font-serif text-lg font-medium tracking-tight text-white sm:text-xl">Brutally Honest Feedback</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#f2efff] sm:leading-8">{renderWithELP(parsed.brutalFeedback, openELP)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(parsed.brutalFeedback, 'Feedback')}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(parsed.brutalFeedback, 'Feedback')}><Volume2 className="h-4 w-4" /></Button>
          </div>
        </Shell>
      )}

      {/* ── Specific Fixes ────────────────────────────────── */}
      {parsed.fixes.length > 0 && (
        <Shell>
          <p className="mb-4 font-serif text-lg font-medium tracking-tight text-white sm:text-xl">🛠️ Specific Fixes</p>
          <div className="grid gap-3">
            {parsed.fixes.map((fix, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-3 rounded-[18px] border border-white/10 bg-[#0b0b12]/50 p-4 sm:rounded-[22px]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-xs font-bold text-[#06060b]">{i + 1}</span>
                <p className="text-sm leading-6 text-[#f2efff]">{renderWithELP(fix, openELP)}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(parsed.fixes.join('\n'), 'Fixes')}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(parsed.fixes.join('. '), 'Fixes')}><Volume2 className="h-4 w-4" /></Button>
          </div>
        </Shell>
      )}
    </div>
  );
}

function TemplatePicker({ value, onChange }: { value: SpeechTemplateId | null; onChange: (id: SpeechTemplateId | null) => void }) {
  const selected = SPEECH_TEMPLATES.find((item) => item.id === value) ?? null;
  return (
    <div className="grid gap-4">
      <Shell>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Speech Format</p>
        <Label.Root className="mb-2 block text-sm text-[#ddd6fe]">Evaluation rubric</Label.Root>
        <Select.Root value={value ?? 'general'} onValueChange={(next) => onChange(next === 'general' ? null : (next as SpeechTemplateId))}>
          <Select.Trigger className="flex h-14 w-full items-center justify-between rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-left text-sm text-[#f2efff] sm:rounded-[22px] sm:px-5">
            <Select.Value placeholder="General evaluation" />
            <Select.Icon><ChevronDown className="h-4 w-4 text-[#857ca2]" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
              <Select.Content position="popper" className="z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12]/95 p-2 text-[#f2efff]">
              <Select.Viewport className="grid gap-1">
                <Select.Item value="general" className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10">
                  <Select.ItemText>General evaluation</Select.ItemText>
                  <Select.ItemIndicator><Check className="h-4 w-4 text-[#a78bfa]" /></Select.ItemIndicator>
                </Select.Item>
                {SPEECH_TEMPLATES.map((template) => (
                  <Select.Item key={template.id} value={template.id} className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10">
                    <Select.ItemText>{template.label}</Select.ItemText>
                    <Select.ItemIndicator><Check className="h-4 w-4 text-[#a78bfa]" /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Shell>
      <AnimatePresence>
        {selected ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-[24px] border border-white/10 sm:rounded-[28px]">
            <Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4" onClick={() => onChange(null)}>
              <X className="h-4 w-4" />
            </Button>
            <Image src={selected.src} alt={selected.label} width={900} height={600} className="h-auto w-full" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const userId = usePersistentUserId();
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(180);
  const [speech, setSpeech] = useState('');
  const [speechAudio, setSpeechAudio] = useState<SpeechAudioState>({
    example: { url: '', isLoading: false },
    clone: { url: '', isLoading: false },
  });
  const [exampleVoice, setExampleVoice] = useState<SpeechExampleVoice>('female');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const speechAudioRef = useRef(speechAudio);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const data = await requestJson<HistoryResponse>(`/api/evaluations/history?userId=${encodeURIComponent(userId)}`, undefined, 25000);
        if (!cancelled) setHistory(data.history || []);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load saved history.');
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [userId]);

  useEffect(() => {
    speechAudioRef.current = speechAudio;
  }, [speechAudio]);

  useEffect(() => {
    return () => {
      Object.values(speechAudioRef.current).forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  // Auto-scroll to feedback after analysis completes
  useEffect(() => {
    if (feedback && feedbackRef.current) {
      const timeout = setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);

  const startRecording = async () => {
    if (!userId) {
      toast.error('User identity is still loading. Please try again.');
      return;
    }

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const audioType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm;codecs=opus';
        const blob = new Blob(chunksRef.current, { type: audioType });
        const sampleBlob = new Blob(chunksRef.current.slice(0, VOICE_SAMPLE_SECONDS), { type: audioType });
        chunksRef.current = [];

        if (blob.size < 3000) {
          toast.error('No audio detected. Please speak clearly and try again.');
          setIsAnalyzing(false);
          return;
        }

        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        form.append('voiceSample', sampleBlob.size >= 3000 ? sampleBlob : blob, 'voice-sample.webm');
        form.append('userId', userId);
        if (selectedTemplateId) form.append('templateId', selectedTemplateId);
        try {
          const data = await requestJson<AnalyzeResponse>('/api/transcribe-analyze', { method: 'POST', body: form }, 140000);
          setTranscript(data.transcript || '');
          setFeedback(data.feedback || '');
          setHistory(data.history || []);
          setSelectedSessionId(null);
          if (data.voiceSampleSaved === false) {
            toast.error('Analysis completed, but the voice sample could not be stored for cloning.');
          }
          toast.success('Speech analyzed and saved.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to analyze speech.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      setIsAnalyzing(false);
      timerRef.current = setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            window.setTimeout(() => stopRecording(), 0);
          }
          return next;
        });
      }, 1000);
      toast.message('Recording started.');
    } catch {
      toast.error('Microphone access is required.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'recording') return;

    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    setIsAnalyzing(true);
  };

  const generateSpeech = async () => {
    if (isGenerating) return;

    if (!topic.trim()) {
      toast.error('Enter a topic first.');
      return;
    }
    setIsGenerating(true);
    setSpeech('');
    Object.values(speechAudioRef.current).forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setSpeechAudio({
      example: { url: '', isLoading: false },
      clone: { url: '', isLoading: false },
    });
    setError('');
    try {
      const data = await requestJson<SpeechResponse>('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, wordCount, userId }),
      }, 70000);
      setSpeech(data.speech || '');
      toast.success('Practice speech generated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSpeechAudio = async (mode: SpeechAudioMode) => {
    if (!speech.trim()) {
      toast.error('First generate a text script.');
      return;
    }

    if (speechAudio[mode].isLoading) return;

    const form = new FormData();
    form.append('mode', mode);
    form.append('text', speech);
    form.append('userId', userId);
    if (mode === 'example') form.append('exampleVoice', exampleVoice);

    if (speechAudioRef.current[mode].url) {
      URL.revokeObjectURL(speechAudioRef.current[mode].url);
    }

    setSpeechAudio((current) => ({
      ...current,
      [mode]: { url: '', isLoading: true },
    }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 180000);

    try {
      const res = await fetch('/api/generate-speech-audio', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not generate speech audio.');
      }

      const blob = await res.blob();
      if (!blob.size) throw new Error('The voice model returned an empty audio file.');
      const url = URL.createObjectURL(blob);
      setSpeechAudio((current) => {
        if (current[mode].url) URL.revokeObjectURL(current[mode].url);
        return {
          ...current,
          [mode]: { url, isLoading: false },
        };
      });
      toast.success(mode === 'clone' ? 'Speech generated in your voice.' : 'Example speech audio generated.');
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Voice generation took too long. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Could not generate speech audio.';
      toast.error(message);
      setSpeechAudio((current) => ({
        ...current,
        [mode]: { ...current[mode], isLoading: false },
      }));
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const data = await requestJson<HistoryResponse>('/api/evaluations/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId }),
      }, 25000);
      setHistory(data.history || []);
      setSelectedSessionId((current) => (current === sessionId ? null : current));
      toast.success('Speech session deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session.');
    }
  };

  const selectedSession = history.find((item) => item.id === selectedSessionId) ?? null;

  const fetchInsights = async () => {
    if (isLoadingInsights) return;
    setIsLoadingInsights(true);
    setInsights([]);
    setWeaknesses([]);
    try {
      const data = await requestJson<InsightsResponse>('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }, 50000);
      setInsights(data.insights || []);
      setWeaknesses(data.weaknesses || []);
      toast.success('Insights generated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const speakText = (value: string, label: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    toast.success(`Reading ${label.toLowerCase()}.`);
  };

  const ActionBar = ({
    text,
    label,
    onRegenerate,
  }: {
    text: string;
    label: string;
    onRegenerate?: () => void;
  }) => (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(text, label)} title={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(text, label)} title={`Read ${label}`}>
        <Volume2 className="h-4 w-4" />
      </Button>
      {onRegenerate ? (
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onRegenerate} title={`Regenerate ${label}`}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  const SpeechAudioActions = () => {
    const items: { mode: SpeechAudioMode; label: string; helper: string }[] = [
      { mode: 'example', label: 'Hear Example Speech', helper: 'Polished public-speaking voice' },
      { mode: 'clone', label: 'Hear in your own voice', helper: 'Uses your latest analyzed sample' },
    ];

    const updateExampleVoice = (voice: SpeechExampleVoice) => {
      if (speechAudio.example.isLoading || exampleVoice === voice) return;
      if (speechAudioRef.current.example.url) {
        URL.revokeObjectURL(speechAudioRef.current.example.url);
      }
      setExampleVoice(voice);
      setSpeechAudio((current) => ({
        ...current,
        example: { url: '', isLoading: false },
      }));
    };

    return (
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const state = speechAudio[item.mode];
          const filename = item.mode === 'clone' ? 'aawaz-your-voice-speech.opus' : `aawaz-example-${exampleVoice}-speech.opus`;
          return (
            <div key={item.mode} className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-3 sm:rounded-[24px] sm:p-4">
              {item.mode === 'example' ? (
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                  {(['female', 'male'] as const).map((voice) => (
                    <button
                      key={voice}
                      type="button"
                      onClick={() => updateExampleVoice(voice)}
                      disabled={state.isLoading}
                      className={cn(
                        'h-8 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.18em] transition disabled:pointer-events-none disabled:opacity-60',
                        exampleVoice === voice
                          ? 'bg-[#ddd6fe] text-[#06060b]'
                          : 'text-[#857ca2] hover:bg-white/10 hover:text-[#f2efff]',
                      )}
                      aria-pressed={exampleVoice === voice}
                    >
                      {voice}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  onClick={() => generateSpeechAudio(item.mode)}
                  disabled={state.isLoading || isGenerating}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.10))] px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#f2efff] transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50 sm:rounded-[18px] lg:w-auto lg:min-w-[220px]"
                >
                  <Play className={cn('h-4 w-4 shrink-0', state.isLoading && 'animate-pulse')} />
                  <span className="min-w-0 break-words">{state.isLoading ? 'Generating...' : item.label}</span>
                </button>
                {state.url ? (
                  <a
                    href={state.url}
                    download={filename}
                    className="inline-flex h-11 w-full items-center justify-center rounded-[16px] border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10 lg:w-11 lg:rounded-full"
                    aria-label={`Download ${item.label.toLowerCase()}`}
                    title={`Download ${item.label.toLowerCase()}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#857ca2]">{item.helper}</div>
              {state.url ? (
                <audio controls src={state.url} className="mt-3 h-10 w-full" preload="metadata" />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const PopupIconButton = ({
    onClick,
    icon,
    label,
    className = '',
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-white/5 text-[#ddd6fe] shadow-[0_0_18px_rgba(167,139,250,0.22)] backdrop-blur-sm transition hover:bg-white/10 hover:text-[#f2efff]',
        className,
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );

  const PopupPanel = ({
    title,
    children,
    onClose,
    align = 'right',
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    align?: 'left' | 'right';
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      className={cn(
        'absolute top-12 z-30 max-h-[60vh] w-[290px] overflow-y-auto rounded-[22px] border border-white/10 bg-[#0b0b12]/95 p-4 shadow-[0_18px_50px_rgba(2,6,23,0.6)] backdrop-blur-sm sm:w-[320px]',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#f87171]/30 bg-[#dc2626]/15 text-[#f87171] hover:bg-[#dc2626]/25"
        aria-label={`Close ${title}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-8 font-mono text-[10px] uppercase tracking-[0.28em] text-[#ddd6fe]">{title}</p>
      <div className="mt-3 text-sm leading-6 text-[#f2efff]">{children}</div>
    </motion.div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(249,168,212,0.16),transparent_28%),linear-gradient(180deg,#06060b_0%,#0b0b12_45%,#11111a_100%)] text-[#f2efff]">
      <Toaster position="top-right" richColors theme="dark" />
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {sidebarOpen ? <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-[84vw] max-w-72 border-r border-white/10 bg-[#0b0b12]/90 p-4 backdrop-blur-sm transition md:static md:w-72 md:max-w-none md:translate-x-0 md:p-5 lg:w-80', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.14))] p-5">
            <div className="font-serif text-4xl tracking-[-0.04em]">Aawaz</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ddd6fe]">Speaker Coach</div>
          </div>
          <div className="mt-6 grid gap-2">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id as Tab); setSidebarOpen(false); }} className={cn('flex items-center gap-3 rounded-[20px] px-4 py-4 text-left transition sm:rounded-[24px]', activeTab === id ? 'bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.12))]' : 'hover:bg-white/6')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#ddd6fe]"><Icon className="h-4 w-4" /></span>
                <span className="text-sm sm:text-base">{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 pb-14 pt-16 sm:px-4 md:px-6 md:pt-8 lg:px-8">
          <div className="mb-5 flex items-center gap-3 sm:gap-4 md:hidden">
            <Button variant="secondary" size="icon" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative shrink-0">
                <PopupIconButton onClick={() => { setCreatorOpen((current) => !current); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                <AnimatePresence>
                  {creatorOpen ? (
                    <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)} align="left">
                      <p>ello boyz and gurls speak your heart out but nabirsa hai AI can make mistakes and very big ones so kei problems aaye ma contact me directly hai! - aawaz</p>
                    </PopupPanel>
                  ) : null}
                </AnimatePresence>
              </div>
              <span className="min-w-0 truncate font-serif text-[1.7rem] tracking-[-0.04em] sm:text-3xl">Aawaz Speaker Coach</span>
              <div className="relative shrink-0">
                <PopupIconButton onClick={() => { setHelpOpen((current) => !current); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" className="h-8 w-8" />
                <AnimatePresence>
                  {helpOpen ? (
                    <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)} align="right">
                      <div className="space-y-2">
                        <p>Use <span className="text-[#ddd6fe]">Speaking Coach</span> to record and get feedback.</p>
                        <p>Use <span className="text-[#ddd6fe]">Speech Practice</span> to generate a sample speech.</p>
                        <p>Use <span className="text-[#ddd6fe]">Speech History</span> to review saved sessions.</p>
                        <p>Use <span className="text-[#ddd6fe]">Progress</span> to track your improvement over time.</p>
                      </div>
                    </PopupPanel>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="grid gap-5">
              <div className="relative z-20">
              <Shell>
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">{activeTab}</p>
                <div className="mt-3 flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="relative hidden shrink-0 md:block">
                      <PopupIconButton onClick={() => { setCreatorOpen((current) => !current); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                      <AnimatePresence>
                        {creatorOpen ? (
                          <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)} align="left">
                            <p>ello boyz and gurls speak your heart out but nabirsa hai AI can make mistakes and very big ones so kei problems aaye ma contact me directly hai! - aawaz</p>
                          </PopupPanel>
                        ) : null}
                      </AnimatePresence>
                    </div>
                    <h1 className="font-serif text-[clamp(2.1rem,6vw,5rem)] leading-[0.95] tracking-[-0.04em] sm:text-[clamp(2.4rem,6vw,5rem)]">
                      {activeTab === 'coach' && 'Speaking Coach'}
                      {activeTab === 'speech' && 'Speech Practice'}
                      {activeTab === 'history' && 'Speech History'}
                      {activeTab === 'progress' && 'Progress'}
                    </h1>
                    <div className="relative hidden shrink-0 md:block">
                      <PopupIconButton onClick={() => { setHelpOpen((current) => !current); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" className="mt-1" />
                      <AnimatePresence>
                        {helpOpen ? (
                          <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)} align="left">
                            <div className="space-y-2">
                              <p>Use <span className="text-[#ddd6fe]">Speaking Coach</span> to record and get feedback.</p>
                              <p>Use <span className="text-[#ddd6fe]">Speech Practice</span> to generate a sample speech.</p>
                              <p>Use <span className="text-[#ddd6fe]">Speech History</span> to review saved sessions.</p>
                              <p>Use <span className="text-[#ddd6fe]">Progress</span> to track your improvement over time.</p>
                            </div>
                          </PopupPanel>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  <div className="flex shrink-0 items-start">
                    {activeTab === 'coach' && (
                      <button
                        type="button"
                        onClick={() => { setTranscript(''); setFeedback(''); setSeconds(0); setSelectedTemplateId(null); setIsRecording(false); setIsAnalyzing(false); toast.success('Ready for a new speech.'); }}
                        className="mt-1 flex shrink-0 flex-col items-center gap-1 transition hover:opacity-80"
                        aria-label="New speech"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.12))] text-[#a78bfa] shadow-[0_0_16px_rgba(167,139,250,0.18)] sm:h-10 sm:w-10">
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#857ca2] sm:text-[9px]">New speech</span>
                      </button>
                    )}
                  </div>
                </div>
                {activeTab === 'coach' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-5 rounded-[20px] border border-white/10 bg-[#0b0b12]/40 p-4 sm:rounded-[24px] sm:p-5"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2] mb-3">How to use</div>
                    <ul className="space-y-2.5">
                      {[
                        'Choose an evaluation template or use the general rubric',
                        'Tap the microphone to record your speech',
                        'Get instant AI-powered feedback with a detailed score',
                      ].map((tip, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-[10px] font-bold text-[#06060b]">{i + 1}</span>
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
                {activeTab === 'speech' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-5 rounded-[20px] border border-white/10 bg-[#0b0b12]/40 p-4 sm:rounded-[24px] sm:p-5"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2] mb-3">How to use</div>
                    <ul className="space-y-2.5">
                      {[
                        'Enter any topic and set your desired word count',
                        'Hit Generate to get an AI-crafted practice speech',
                        'Read it aloud, then switch to Speaking Coach to record',
                      ].map((tip, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-[10px] font-bold text-[#06060b]">{i + 1}</span>
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
                {activeTab === 'history' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-5 rounded-[20px] border border-white/10 bg-[#0b0b12]/40 p-4 sm:rounded-[24px] sm:p-5"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2] mb-3">How to use</div>
                    <ul className="space-y-2.5">
                      {[
                        'Browse your saved sessions and tap to expand details',
                        'Review transcripts and full coach feedback for each session',
                        'Delete sessions you no longer need',
                      ].map((tip, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-[10px] font-bold text-[#06060b]">{i + 1}</span>
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
                {activeTab === 'progress' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-5 rounded-[20px] border border-white/10 bg-[#0b0b12]/40 p-4 sm:rounded-[24px] sm:p-5"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2] mb-3">How to use</div>
                    <ul className="space-y-2.5">
                      {[
                        'Track your score trend over time in the chart below',
                        'Generate AI insights to understand your strengths',
                        'Identify recurring weaknesses and target them in practice',
                      ].map((tip, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-[10px] font-bold text-[#06060b]">{i + 1}</span>
                          {tip}
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </Shell>
              </div>

              {activeTab === 'coach' && (
                <>
                  <TemplatePicker value={selectedTemplateId} onChange={setSelectedTemplateId} />
                  <Shell>
                    <div className="grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
                      <div className="space-y-4">
                        <div className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-4 sm:rounded-[24px] sm:p-5">
                          <div className="flex flex-wrap gap-3">
                            <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-sm">Status: {isAnalyzing ? 'Analyzing' : isRecording ? 'Recording' : 'Ready'}</div>
                            <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-sm">Timer: {seconds}s</div>
                          </div>
                        </div>
                        {isRecording && (
                          <div className="flex h-14 items-center gap-1 overflow-hidden rounded-[20px] border border-white/10 bg-white/6 px-3 sm:h-16 sm:rounded-[24px] sm:px-4">
                            {Array.from({ length: 30 }).map((_, index) => (
                              <motion.div key={index} animate={{ scaleY: [0.35, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: index * 0.03 }} className={cn('w-1 rounded-full', index % 3 === 0 ? 'bg-[#f9a8d4]' : 'bg-[#a78bfa]')} style={{ height: 42 }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <motion.button whileTap={{ scale: 0.96 }} animate={isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ duration: 1.8, repeat: isRecording ? Infinity : 0 }} onClick={isRecording ? stopRecording : startRecording} disabled={isAnalyzing} className={cn('flex h-28 w-28 items-center justify-center rounded-full border text-[#f2efff] shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:h-32 sm:w-32 lg:h-36 lg:w-36', isRecording ? 'border-[#f87171]/30 bg-[linear-gradient(135deg,#dc2626,#f87171)]' : 'border-white/10 bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] text-[#06060b]')}>
                          {isAnalyzing ? <Sparkles className="h-10 w-10 animate-spin" /> : isRecording ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                        </motion.button>
                        <div className="text-center font-mono text-[10px] uppercase tracking-[0.24em] text-[#857ca2] sm:text-[11px] sm:tracking-[0.3em]">{isAnalyzing ? 'Analyzing' : isRecording ? 'Tap to stop' : 'Tap to speak'}</div>
                      </div>
                    </div>
                  </Shell>
                  {transcript && <Shell><p className="mb-3 font-serif text-lg font-medium tracking-tight text-white sm:text-xl">Transcript</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{transcript}</p><ActionBar text={transcript} label="Transcript" /></Shell>}
                  {feedback && <div ref={feedbackRef}><FeedbackDisplay feedback={feedback} copyText={copyText} speakText={speakText} /></div>}
                </>
              )}

              {activeTab === 'speech' && (
                <>
                  <Shell>
                    <Label.Root htmlFor="speech-topic" className="mb-2 block text-sm text-[#ddd6fe]">Speech topic</Label.Root>
                    <div className="grid gap-4 lg:grid-cols-[1fr,auto,auto]">
                      <input id="speech-topic" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generateSpeech()} placeholder="e.g. Leadership, climate change, discipline" className="h-14 min-w-0 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none placeholder:text-[#857ca2] sm:rounded-[22px] sm:px-5" />
                      <div className="flex h-14 items-center justify-between gap-3 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-3 text-[#f2efff] sm:rounded-[22px] lg:w-[260px]">
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ddd6fe]">Words</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setWordCount((current) => Math.max(80, current - 25))} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10" aria-label="Decrease word count">-</button>
                          <input
                            aria-label="Speech word count"
                            value={wordCount}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (Number.isNaN(next)) return;
                              setWordCount(Math.min(500, Math.max(80, next)));
                            }}
                            className="h-8 w-14 rounded-full border border-[#a78bfa]/30 bg-white/5 text-center font-mono text-sm text-[#f2efff] outline-none focus:border-[#a78bfa]/70"
                            inputMode="numeric"
                          />
                          <button type="button" onClick={() => setWordCount((current) => Math.min(500, current + 25))} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10" aria-label="Increase word count">+</button>
                        </div>
                      </div>
                      <Button onClick={generateSpeech} disabled={isGenerating || !topic.trim()} className="h-14 w-full rounded-[18px] px-6 font-mono text-xs uppercase tracking-[0.22em] sm:rounded-[22px] md:w-auto md:tracking-[0.28em]">
                        <Sparkles className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
                        {isGenerating ? 'Writing...' : 'Generate'}
                      </Button>
                    </div>
                    {error ? <p className="mt-3 font-mono text-xs text-[#f87171]">{error}</p> : null}
                  </Shell>
                  {(speech || isGenerating) && (
                    <Shell>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Sample Speech</p>
                        {!isGenerating && <Button variant="ghost" size="icon" onClick={generateSpeech}><RefreshCw className="h-4 w-4" /></Button>}
                      </div>
                      {isGenerating ? <div className="flex gap-2">{[0, 1, 2].map((i) => <motion.div key={i} animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }} className="h-2 w-2 rounded-full bg-[#a78bfa]" />)}</div> : <><SpeechAudioActions /><p className="whitespace-pre-wrap break-words text-[15px] leading-7 sm:leading-8 text-[#f2efff]">{speech}</p><ActionBar text={speech} label="Speech" onRegenerate={generateSpeech} /></>}
                    </Shell>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <>
                  <Shell>
                    <div className="grid gap-3">
                      {history.length ? history.map((item, index) => (
                        <motion.button key={item.id} whileHover={{ y: -2 }} onClick={() => setSelectedSessionId(selectedSessionId === item.id ? null : item.id)} className={cn('w-full rounded-[20px] border p-4 text-left sm:rounded-[24px] sm:p-5', selectedSessionId === item.id ? 'border-[#a78bfa]/40 bg-[linear-gradient(135deg,rgba(167,139,250,0.14),rgba(249,168,212,0.10))]' : 'border-white/10 bg-white/4')}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ddd6fe] sm:text-[11px] sm:tracking-[0.28em]">Session {history.length - index} | {formatHistoryDate(item.created_at)}</div>
                            <Button variant="danger" size="icon" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); deleteSession(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          <div className="break-words text-sm sm:text-base">{item.template_label ?? 'General Evaluation'}</div>
                          <div className="mt-1 break-words font-mono text-xs text-[#857ca2]">{item.overall_score ?? 'No'} / 100 {item.words_per_min ? `| ${item.words_per_min} wpm` : ''}</div>
                        </motion.button>
                      )) : <div className="rounded-[24px] border border-dashed border-white/20 bg-white/4 px-5 py-6 font-mono text-sm text-[#857ca2]">Saved speeches will appear here after the first evaluation.</div>}
                    </div>
                  </Shell>
                  {selectedSession && (
                    <>
                      <Shell><p className="mb-3 font-serif text-lg font-medium tracking-tight text-white sm:text-xl">Transcript</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{selectedSession.transcript}</p><ActionBar text={selectedSession.transcript} label="Transcript" /></Shell>
                      <FeedbackDisplay feedback={selectedSession.feedback} copyText={copyText} speakText={speakText} />
                    </>
                  )}
                </>
              )}

              {activeTab === 'progress' && (
                <>
                  <Shell>
                    <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Score Trend</p>
                    <ProgressChart history={history} />
                  </Shell>
                  <Shell>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">AI Insights</p>
                      <Button onClick={fetchInsights} disabled={isLoadingInsights || history.length === 0} className="h-11 rounded-[18px] px-5 font-mono text-xs uppercase tracking-[0.22em] sm:rounded-[22px]">
                        <BarChart3 className={cn('h-4 w-4', isLoadingInsights && 'animate-spin')} />
                        {isLoadingInsights ? 'Analyzing...' : 'View Insights'}
                      </Button>
                    </div>
                    {isLoadingInsights && (
                      <div className="mt-5 flex gap-2">
                        {[0, 1, 2].map((i) => <motion.div key={i} animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }} className="h-2 w-2 rounded-full bg-[#a78bfa]" />)}
                      </div>
                    )}
                    {insights.length > 0 && !isLoadingInsights && (
                      <div className="mt-5 space-y-3">
                        {insights.map((insight, i) => (
                          <div key={i} className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-4 sm:rounded-[24px] sm:p-5">
                            <p className="break-words text-sm leading-6 text-[#f2efff]">{insight}</p>
                            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyText(insight, 'Insight')} title="Copy insight"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => speakText(insight, 'Insight')} title="Read insight"><Volume2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Shell>
                  {weaknesses.length > 0 && !isLoadingInsights && (
                    <Shell>
                      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Weaknesses</p>
                      <div className="space-y-3">
                        {weaknesses.map((weakness, i) => (
                          <div key={i} className="rounded-[20px] border border-[#f87171]/15 bg-[#dc2626]/5 p-4 sm:rounded-[24px] sm:p-5">
                            <p className="break-words text-sm leading-6 text-[#f2efff]">{weakness}</p>
                            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyText(weakness, 'Weakness')} title="Copy weakness"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => speakText(weakness, 'Weakness')} title="Read weakness"><Volume2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Shell>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
