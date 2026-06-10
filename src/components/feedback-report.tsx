'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  ChevronDown,
  Copy,
  Ear,
  FileText,
  Flame,
  Gauge,
  LayoutList,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';

import { CoachMascot } from '@/components/mascot';
import { ScoreRing } from '@/components/score-ring';
import { Button } from '@/components/ui/button';
import { Eyebrow, SectionTitle, Shell } from '@/components/ui/shell';
import { parseFeedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';

type TextAction = (value: string, label: string) => void;

/* ── ELP Explainer Popup ─────────────────────────────────────────── */
function ELPPopup({ onClose }: { onClose: () => void }) {
  const pillars = [
    {
      title: 'Ethos — Credibility',
      accent: '#a78bfa',
      body: 'Establish why the audience should trust you on this topic. Share first-hand experience, qualifications, or deep personal understanding.',
      example: '"I grew up in a family that lived below the poverty line — I don\'t speak about poverty from a textbook, I speak from memory. I know the weight of choosing between food and medicine."',
    },
    {
      title: 'Logos — Logic',
      accent: '#a78bfa',
      body: 'Build your case with facts, statistics, data, and logical reasoning that make the argument intellectually undeniable.',
      example: '"According to the World Bank, roughly 700 million people still live on less than $2.15 a day. UNICEF reports that 5.2 million children under five died in 2019 — many from preventable causes directly linked to poverty."',
    },
    {
      title: 'Pathos — Emotion',
      accent: '#f9a8d4',
      body: 'Create genuine emotional resonance. Paint vivid, visceral imagery that moves the audience to feel the weight of your message.',
      example: '"Imagine a mother who loves her child more than life itself — but can do nothing but watch that child perish from a treatable disease, because she cannot afford the medication. That is not a scene from a dystopian film. That is reality for millions, right now, as we speak."',
    },
  ];

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close ELP explainer"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] border border-white/10 bg-[#0d0c16]/95 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.7)] backdrop-blur-xl sm:rounded-[28px] sm:p-7"
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
          {pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-[18px] border border-white/10 bg-white/4 p-4 sm:rounded-[22px]">
              <div className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: pillar.accent }}>{pillar.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#f2efff]">{pillar.body}</p>
              <p className="mt-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-[13px] italic leading-relaxed text-[#ddd6fe]">{pillar.example}</p>
            </div>
          ))}
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

/* ── Collapsible section ─────────────────────────────────────────── */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  tone = 'default',
  actions,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Shell tone={tone} className="overflow-hidden p-0 sm:p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/4 sm:px-6 sm:py-5"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {icon}
          <SectionTitle className="truncate">{title}</SectionTitle>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#857ca2] transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
              {children}
              {actions ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">{actions}</div> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Shell>
  );
}

function metricIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('filler')) return <AudioLines className="h-4 w-4" />;
  if (lower.includes('speed') || lower.includes('pace')) return <Gauge className="h-4 w-4" />;
  if (lower.includes('clarity') || lower.includes('volume')) return <Ear className="h-4 w-4" />;
  if (lower.includes('structure')) return <LayoutList className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function TextActions({ value, label, copyText, speakText }: { value: string; label: string; copyText: TextAction; speakText: TextAction }) {
  return (
    <>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(value, label)} title={`Copy ${label.toLowerCase()}`}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(value, label)} title={`Read ${label.toLowerCase()} aloud`}>
        <Volume2 className="h-4 w-4" />
      </Button>
    </>
  );
}

/* ── Coach Report ────────────────────────────────────────────────── */
export function FeedbackReport({
  feedback,
  copyText,
  speakText,
}: {
  feedback: string;
  copyText: TextAction;
  speakText: TextAction;
}) {
  const parsed = useMemo(() => parseFeedback(feedback), [feedback]);
  const hasSections = parsed.analysisItems.length > 0 || parsed.brutalFeedback || parsed.fixes.length > 0;
  const [elpOpen, setElpOpen] = useState(false);
  const openELP = () => setElpOpen(true);

  const mascotMood = parsed.score === null ? 'coach' : parsed.score >= 70 ? 'cheer' : parsed.score >= 45 ? 'coach' : 'oops';

  if (!hasSections) {
    return (
      <Shell>
        <Eyebrow className="mb-3">Coach Verdict</Eyebrow>
        <p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-[#f2efff] sm:leading-8">{renderWithELP(feedback, openELP)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <TextActions value={feedback} label="Feedback" copyText={copyText} speakText={speakText} />
        </div>
        <AnimatePresence>{elpOpen && <ELPPopup onClose={() => setElpOpen(false)} />}</AnimatePresence>
      </Shell>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      <AnimatePresence>{elpOpen && <ELPPopup onClose={() => setElpOpen(false)} />}</AnimatePresence>

      {/* ── Score + mascot header ─────────────────────────── */}
      {parsed.score !== null && (
        <Shell tone="accent">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
            <ScoreRing value={parsed.score} />
            <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <CoachMascot mood={mascotMood} size={84} />
              <Eyebrow>Coach report</Eyebrow>
              <p className="max-w-[240px] text-sm leading-6 text-[#cfc8e8]">
                {parsed.score >= 70
                  ? 'That had presence. Read the fixes anyway — great speakers drill the details.'
                  : parsed.score >= 45
                    ? 'There\'s a real speech in there. The fixes below will pull it out.'
                    : 'Rough one. Good — now you know exactly what to drill.'}
              </p>
            </div>
          </div>
        </Shell>
      )}

      {/* ── Analysis metrics ──────────────────────────────── */}
      {parsed.analysisItems.length > 0 && (
        <Shell>
          <SectionTitle className="mb-4">Analysis</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {parsed.analysisItems.map((item, i) => {
              const isStructure = item.label.toLowerCase().includes('structure');
              const structureBullets = isStructure ? item.value.split(/[.;]/).map((s) => s.trim()).filter(Boolean) : [];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={cn(
                    'rounded-[18px] border border-white/10 bg-[#0b0b12]/50 p-4 transition-colors hover:border-[#a78bfa]/25 sm:rounded-[22px]',
                    isStructure && 'sm:col-span-2',
                  )}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#ddd6fe] sm:text-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#a78bfa]/12 text-[#a78bfa]">{metricIcon(item.label)}</span>
                    {item.label}
                  </div>
                  {isStructure && structureBullets.length > 1 ? (
                    <ul className="mt-3 grid gap-2">
                      {structureBullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-2.5 text-sm leading-relaxed text-[#f2efff]">
                          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#a78bfa]"></span>
                          {renderWithELP(b, openELP)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2.5 text-sm font-medium text-[#f2efff] sm:text-base">{renderWithELP(item.value, openELP)}</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Shell>
      )}

      {/* ── Brutal feedback ───────────────────────────────── */}
      {parsed.brutalFeedback && (
        <CollapsibleSection
          title="Brutally Honest Feedback"
          icon={<Flame className="h-4 w-4 text-[#f87171]" />}
          tone="danger"
          actions={<TextActions value={parsed.brutalFeedback} label="Feedback" copyText={copyText} speakText={speakText} />}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#f2efff] sm:leading-8">{renderWithELP(parsed.brutalFeedback, openELP)}</p>
        </CollapsibleSection>
      )}

      {/* ── Specific fixes ────────────────────────────────── */}
      {parsed.fixes.length > 0 && (
        <CollapsibleSection
          title="Your 3 Fixes"
          icon={<Wrench className="h-4 w-4 text-[#a78bfa]" />}
          actions={<TextActions value={parsed.fixes.join('\n')} label="Fixes" copyText={copyText} speakText={speakText} />}
        >
          <div className="grid gap-3">
            {parsed.fixes.map((fix, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.09 }}
                className="flex gap-3 rounded-[18px] border border-white/10 bg-[#0b0b12]/50 p-4 transition-colors hover:border-[#f9a8d4]/25 sm:rounded-[22px]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] font-mono text-xs font-bold text-[#06060b]">{i + 1}</span>
                <p className="text-sm leading-6 text-[#f2efff]">{renderWithELP(fix, openELP)}</p>
              </motion.div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
