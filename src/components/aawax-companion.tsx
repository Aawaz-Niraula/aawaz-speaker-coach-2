'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HelpCircle, Map, Sparkles, X } from 'lucide-react';

import { CoachMascot, type MascotMood } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

type CompanionTab = 'coach' | 'speech' | 'history' | 'progress' | 'account';
type CompanionPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'center';

type TourStep = {
  tab: CompanionTab;
  title: string;
  body: string;
  mood: MascotMood;
  position: CompanionPosition;
  targetLabel: string;
};

const TOUR_STORAGE_KEY = 'aawax-onboarding-v1';

const TOUR_STEPS: TourStep[] = [
  {
    tab: 'coach',
    title: 'Pick your arena',
    body: 'Start by choosing a rubric. General is fine, but templates make me judge your speech against the exact format.',
    mood: 'coach',
    position: 'bottom-right',
    targetLabel: 'Speech format',
  },
  {
    tab: 'coach',
    title: 'Tap the mic',
    body: 'When you press record, I listen for pacing, clarity, structure, fillers, and whether the speech actually lands.',
    mood: 'listen',
    position: 'center',
    targetLabel: 'Recorder',
  },
  {
    tab: 'coach',
    title: 'Read the report',
    body: 'After analysis, scroll into the coach report. The score is useful, but the fixes are where the real improvement hides.',
    mood: 'think',
    position: 'bottom-left',
    targetLabel: 'Feedback report',
  },
  {
    tab: 'speech',
    title: 'Practice studio',
    body: 'Generate a practice speech, then hear it in an example voice or try your own saved voice sample when the provider is healthy.',
    mood: 'sing',
    position: 'bottom-right',
    targetLabel: 'Speech generator',
  },
  {
    tab: 'history',
    title: 'Your archive',
    body: 'Every finished speech appears here. Open old sessions to compare the same mistakes across time.',
    mood: 'idle',
    position: 'top-right',
    targetLabel: 'History',
  },
  {
    tab: 'progress',
    title: 'Progress is the prize',
    body: 'Use the progress tab for score trends, insights, and recurring weak spots. Small gains still count.',
    mood: 'cheer',
    position: 'bottom-right',
    targetLabel: 'Progress',
  },
  {
    tab: 'account',
    title: 'Make me yours',
    body: 'Create an account to keep your history safe, then customise your avatar and my Aawax look whenever you want.',
    mood: 'cheer',
    position: 'bottom-left',
    targetLabel: 'Account and customisation',
  },
];

function useTypewriter(text: string, active: boolean) {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!active || reduceMotion) {
      return;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      setDisplayed(text.slice(0, index));
      index += 1;
      if (index >= text.length) {
        window.clearInterval(interval);
      }
    }, 18);

    return () => window.clearInterval(interval);
  }, [active, reduceMotion, text]);

  return active && !reduceMotion ? displayed : text;
}

function positionClass(position: CompanionPosition) {
  switch (position) {
    case 'bottom-left':
      return 'bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 md:bottom-6 md:left-[22rem]';
    case 'top-right':
      return 'right-3 top-24 md:right-8 md:top-28';
    case 'center':
      return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2';
    case 'bottom-right':
    default:
      return 'bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 md:bottom-6 md:right-8';
  }
}

function contextFor(tab: CompanionTab, flags: AawaxCompanionProps['flags']): TourStep {
  if (flags.isRecording) {
    return {
      tab,
      title: 'I am listening',
      body: 'Keep going. Aim for clean openings, deliberate pauses, and fewer filler words. I will handle the notes.',
      mood: 'listen',
      position: 'bottom-right',
      targetLabel: 'Recording',
    };
  }

  if (flags.isAnalyzing) {
    return {
      tab,
      title: 'Coach brain loading',
      body: 'I am turning your speech into a report. Give me a moment; the useful part is coming.',
      mood: 'think',
      position: 'bottom-right',
      targetLabel: 'Analysis',
    };
  }

  if (flags.hasFeedback && tab === 'coach') {
    return {
      tab,
      title: 'Start with one fix',
      body: 'Do not try to fix everything at once. Pick the harshest comment, rehearse it twice, then record again.',
      mood: 'coach',
      position: 'bottom-left',
      targetLabel: 'Coach report',
    };
  }

  if (tab === 'speech') {
    return {
      tab,
      title: flags.hasSpeech ? 'Now perform it' : 'Need a topic?',
      body: flags.hasSpeech
        ? 'Read the draft out loud once, then regenerate only if the structure misses your goal.'
        : 'Try a specific topic: “why discipline beats motivation” is stronger than just “discipline.”',
      mood: flags.hasSpeech ? 'cheer' : 'coach',
      position: 'bottom-right',
      targetLabel: 'Speech practice',
    };
  }

  if (tab === 'history') {
    return {
      tab,
      title: flags.hasHistory ? 'Look for patterns' : 'Your stage is empty',
      body: flags.hasHistory
        ? 'Open two reports and compare the repeated weaknesses. Repeated mistakes are where training should begin.'
        : 'Record one speech first. I will keep the transcript and verdict here for review.',
      mood: flags.hasHistory ? 'think' : 'idle',
      position: 'top-right',
      targetLabel: 'Speech history',
    };
  }

  if (tab === 'progress') {
    return {
      tab,
      title: flags.hasHistory ? 'Numbers with teeth' : 'Progress starts after session one',
      body: flags.hasHistory
        ? 'Use trends as a mirror. If the score rises but pace stays messy, practice pacing before chasing topics.'
        : 'Once you record, this turns into your improvement board with scores and insights.',
      mood: flags.hasHistory ? 'cheer' : 'coach',
      position: 'bottom-right',
      targetLabel: 'Progress',
    };
  }

  if (tab === 'account') {
    return {
      tab,
      title: 'Your backstage pass',
      body: 'Account keeps your history, avatar, and voice sample attached to you. The danger buttons are intentionally serious.',
      mood: 'idle',
      position: 'bottom-left',
      targetLabel: 'Account',
    };
  }

  return TOUR_STEPS[0];
}

export type AawaxCompanionProps = {
  activeTab: CompanionTab;
  onTabChange: (tab: CompanionTab) => void;
  onCustomize: () => void;
  flags: {
    isRecording: boolean;
    isAnalyzing: boolean;
    isGenerating: boolean;
    isVoiceBusy: boolean;
    hasFeedback: boolean;
    hasHistory: boolean;
    hasSpeech: boolean;
  };
};

export function AawaxCompanion({ activeTab, onTabChange, onCustomize, flags }: AawaxCompanionProps) {
  const [mode, setMode] = useState<'closed' | 'tour' | 'context'>('closed');
  const [stepIndex, setStepIndex] = useState(0);
  const [boopCount, setBoopCount] = useState(0);
  const [tourSeen, setTourSeen] = useState(true);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(TOUR_STORAGE_KEY) === 'seen';
    } catch {
      seen = true;
    }

    const syncSeen = window.setTimeout(() => setTourSeen(seen), 0);
    const openTour = seen ? undefined : window.setTimeout(() => setMode('tour'), 900);

    return () => {
      window.clearTimeout(syncSeen);
      if (openTour) window.clearTimeout(openTour);
    };
  }, []);

  const activeStep = mode === 'tour' ? TOUR_STEPS[stepIndex] : contextFor(activeTab, flags);
  const typedBody = useTypewriter(activeStep.body, mode !== 'closed');
  const isBusy = flags.isRecording || flags.isAnalyzing || flags.isGenerating || flags.isVoiceBusy;

  useEffect(() => {
    if (mode === 'tour') {
      onTabChange(activeStep.tab);
    }
  }, [activeStep.tab, mode, onTabChange]);

  const progress = mode === 'tour' ? ((stepIndex + 1) / TOUR_STEPS.length) * 100 : 100;

  const close = () => {
    sfx.pop();
    setMode('closed');
  };

  const completeTour = () => {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'seen');
    } catch {
      // ignore storage errors
    }
    setTourSeen(true);
    setMode('closed');
    sfx.success();
  };

  const startTour = () => {
    sfx.shuffle();
    setStepIndex(0);
    setMode('tour');
  };

  const openContext = () => {
    sfx.pop();
    setMode('context');
  };

  const next = () => {
    sfx.tick();
    if (stepIndex >= TOUR_STEPS.length - 1) {
      completeTour();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const previous = () => {
    sfx.tick();
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const mascotMood = useMemo<MascotMood>(() => {
    if (boopCount >= 3) return 'cheer';
    if (isBusy && mode === 'closed') {
      if (flags.isRecording) return 'listen';
      if (flags.isAnalyzing || flags.isGenerating) return 'think';
      if (flags.isVoiceBusy) return 'sing';
    }
    return activeStep.mood;
  }, [activeStep.mood, boopCount, flags.isAnalyzing, flags.isGenerating, flags.isRecording, flags.isVoiceBusy, isBusy, mode]);

  const boop = () => {
    setBoopCount((count) => {
      const nextCount = count + 1;
      if (nextCount === 3) {
        sfx.fanfare();
        window.setTimeout(() => setBoopCount(0), 1600);
      }
      return nextCount;
    });
  };

  return (
    <>
      <div className="fixed right-3 top-[5.2rem] z-30 hidden flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={openContext}
          className="group flex items-center gap-2 rounded-full border border-[#a78bfa]/25 bg-[#0d0c16]/85 px-3 py-2 text-[#ddd6fe] shadow-[0_14px_45px_rgba(2,6,23,0.45)] backdrop-blur-xl transition hover:border-[#a78bfa]/50 hover:bg-white/10"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Ask Aawax</span>
        </button>
        <button
          type="button"
          onClick={startTour}
          className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[#a79dc8] shadow-[0_14px_45px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-[#f2efff]"
        >
          <Map className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{tourSeen ? 'Replay tour' : 'Start tour'}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={openContext}
        className="fixed bottom-[calc(5.1rem+env(safe-area-inset-bottom))] right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-[#0d0c16]/90 text-[#ddd6fe] shadow-[0_16px_45px_rgba(2,6,23,0.5)] backdrop-blur-xl md:hidden"
        aria-label="Ask Aawax"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {mode !== 'closed' ? (
          <motion.div
            key={`${mode}-${stepIndex}-${activeStep.position}`}
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className={cn('fixed z-[70] w-[min(92vw,390px)]', positionClass(activeStep.position))}
          >
            {mode === 'tour' ? (
              <motion.div
                className="pointer-events-none absolute -inset-3 rounded-[30px] border border-[#a78bfa]/30 shadow-[0_0_42px_rgba(167,139,250,0.22)]"
                animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.015, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
            ) : null}
            <div className="relative overflow-hidden rounded-[26px] border border-white/12 bg-[#0d0c16]/95 p-4 shadow-[0_26px_90px_rgba(2,6,23,0.78)] backdrop-blur-2xl">
              <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(221,214,254,0.55),transparent)]" />
              <div className="flex items-start gap-3">
                <div onClick={boop} onKeyDown={(event) => event.key === 'Enter' && boop()} role="button" tabIndex={0} className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/70">
                  <CoachMascot mood={mascotMood} size={70} float />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#857ca2]">
                        {mode === 'tour' ? `Tour ${stepIndex + 1}/${TOUR_STEPS.length}` : 'Aawax guide'}
                      </p>
                      <p className="mt-1 font-serif text-xl leading-none tracking-tight text-white">{activeStep.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#857ca2] transition hover:bg-white/10 hover:text-white"
                      aria-label="Close Aawax guide"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 min-h-[4.5rem] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-[#d9d2ef]">
                    {typedBody}
                    <motion.span
                      className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 rounded-full bg-[#f9a8d4]"
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full border border-[#a78bfa]/25 bg-[#a78bfa]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#ddd6fe]">
                      {activeStep.targetLabel}
                    </span>
                    {boopCount > 0 ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#857ca2]">
                        Boop x{boopCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)]"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {mode === 'tour' ? (
                  <>
                    <button
                      type="button"
                      onClick={completeTour}
                      className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2] transition hover:text-[#f2efff]"
                    >
                      Skip
                    </button>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={previous} disabled={stepIndex === 0} className="h-9 rounded-[14px] px-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                        Back
                      </Button>
                      <Button onClick={next} className="h-9 rounded-[14px] px-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                        {stepIndex === TOUR_STEPS.length - 1 ? 'Got it' : 'Next'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startTour}
                      className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2] transition hover:text-[#f2efff]"
                    >
                      Full tour
                    </button>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={onCustomize} className="h-9 rounded-[14px] px-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                        Dress-up
                      </Button>
                      <Button onClick={close} className="h-9 rounded-[14px] px-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                        Got it
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
