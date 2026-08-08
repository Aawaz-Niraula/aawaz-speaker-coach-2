'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';
import { Map, X } from 'lucide-react';

import { CoachMascot, type MascotMood } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

type CompanionTab = 'coach' | 'speech' | 'history' | 'progress' | 'account' | 'aawax';
type CompanionPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'center' | 'side';

type TourStep = {
  tab: CompanionTab;
  title: string;
  body: string;
  mood: MascotMood;
  position: CompanionPosition;
  targetLabel: string;
};

/**
 * Where Aawax stands for each tour step, in viewport units.
 *
 * The character walks to these spots; the speech bubble is anchored to Aawax
 * and follows. `flip` puts the bubble on the left when Aawax is near the right
 * edge, so it never runs off screen.
 */
const TOUR_SPOTS: Record<CompanionPosition, { x: string; y: string; flip: boolean }> = {
  'bottom-right': { x: 'calc(100vw - 12rem)', y: 'calc(100vh - 13rem)', flip: true },
  'bottom-left': { x: '6rem', y: 'calc(100vh - 13rem)', flip: false },
  'top-right': { x: 'calc(100vw - 12rem)', y: '9rem', flip: true },
  center: { x: '50vw', y: '52vh', flip: false },
  side: { x: 'calc(100vw - 12rem)', y: '50vh', flip: true },
};

const TOUR_STORAGE_KEY = 'aawax-onboarding-v1';

const TOUR_STEPS: TourStep[] = [
  {
    tab: 'coach',
    title: 'Pick your arena',
    body: 'Start by choosing a rubric. General is fine, but templates make me judge your speech against the exact format.',
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Speech format',
  },
  {
    tab: 'coach',
    title: 'Tap the mic',
    body: 'When you press record, I listen for pacing, clarity, structure, fillers, and whether the speech actually lands.',
    mood: 'talk',
    position: 'center',
    targetLabel: 'Recorder',
  },
  {
    tab: 'coach',
    title: 'Read the report',
    body: 'After analysis, scroll into the coach report. The score is useful, but the fixes are where the real improvement hides.',
    mood: 'talk',
    position: 'bottom-left',
    targetLabel: 'Feedback report',
  },
  {
    tab: 'speech',
    title: 'Practice studio',
    body: 'Generate a practice speech, then hear it in an example voice or try your own saved voice sample when the provider is healthy.',
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Speech generator',
  },
  {
    tab: 'history',
    title: 'Your archive',
    body: 'Every finished speech appears here. Open old sessions to compare the same mistakes across time.',
    mood: 'talk',
    position: 'top-right',
    targetLabel: 'History',
  },
  {
    tab: 'progress',
    title: 'Progress is the prize',
    body: 'Use the progress tab for score trends, insights, and recurring weak spots. Small gains still count.',
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Progress',
  },
  {
    tab: 'account',
    title: 'Make me yours',
    body: 'Create an account to keep your history safe, then customise your avatar and my Aawax look whenever you want.',
    mood: 'talk',
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
        : 'Try a specific topic: "why discipline beats motivation" is stronger than just "discipline."',
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
  onOpenChat: () => void;
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

export function AawaxCompanion({ activeTab, onTabChange, onOpenChat, flags }: AawaxCompanionProps) {
  const [mode, setMode] = useState<'closed' | 'tour'>('closed');
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
  const typedBody = useTypewriter(activeStep.body, mode === 'tour');
  const isBusy = flags.isRecording || flags.isAnalyzing || flags.isGenerating || flags.isVoiceBusy;

  useEffect(() => {
    if (mode === 'tour') {
      onTabChange(activeStep.tab);
    }
  }, [activeStep.tab, mode, onTabChange]);

  const spot = TOUR_SPOTS[activeStep.position];

  const completeTour = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'seen');
    } catch {
      // ignore storage errors
    }
    setTourSeen(true);
    setMode('closed');
    sfx.success();
  }, []);

  // Escape leaves the tour at any moment, including the first frame.
  useEffect(() => {
    if (mode !== 'tour') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') completeTour();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, completeTour]);

  const startTour = () => {
    sfx.shuffle();
    setStepIndex(0);
    setMode('tour');
  };

  const openChat = () => {
    sfx.pop();
    setMode('closed');
    onOpenChat();
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

  /* Trackable, per-action movement for the docked companion. Each state gives
     Aawax a distinct gait so it feels alive and reacts to what you're doing.
     Transform-only (GPU-friendly); fully stilled under reduced motion. */
  const reduceMotion = useReducedMotion();
  const companionMotion = useMemo<{ animate?: TargetAndTransition; transition?: Transition }>(() => {
    if (reduceMotion) return { animate: undefined, transition: undefined };
    switch (mascotMood) {
      case 'listen': // recording — attentive lean-in bob
        return { animate: { y: [0, -5, 0], rotate: [0, -2.5, 2.5, 0] }, transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } };
      case 'think': // analyzing / generating — pacing side to side
        return { animate: { x: [0, 9, -9, 0] }, transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } };
      case 'sing': // voice work — bouncy wobble
        return { animate: { y: [0, -9, 0], rotate: [-4, 4, -4, 0] }, transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } };
      case 'cheer': // success — celebratory hops
        return { animate: { y: [0, -12, 0], scale: [1, 1.06, 1] }, transition: { duration: 0.7, repeat: Infinity, ease: 'easeOut' } };
      default: // idle — gentle sideways drift
        return { animate: { x: [0, 7, 0, -7, 0], y: [0, -4, 0, -4, 0] }, transition: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' } };
    }
  }, [mascotMood, reduceMotion]);

  return (
    <>
      <motion.div
        className="gpu-layer fixed bottom-6 right-8 z-30 hidden flex-col items-end gap-2 md:flex"
        animate={companionMotion.animate}
        transition={companionMotion.transition}
      >
        <button
          type="button"
          onClick={openChat}
          className="group flex items-center gap-2 rounded-full border border-[#a78bfa]/25 bg-[#0d0c16]/88 py-2 pl-2 pr-3 text-[#ddd6fe] shadow-[0_18px_55px_rgba(2,6,23,0.52)] backdrop-blur-xl transition hover:border-[#a78bfa]/55 hover:bg-white/10"
          aria-label="Open Aawax chat"
        >
          <CoachMascot mood={mascotMood} size={38} float={false} />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Aawax</span>
        </button>
        <button
          type="button"
          onClick={startTour}
          className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[#a79dc8] shadow-[0_14px_45px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 hover:text-[#f2efff]"
        >
          <Map className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{tourSeen ? 'Replay tour' : 'Start tour'}</span>
        </button>
      </motion.div>

      <motion.button
        type="button"
        onClick={openChat}
        animate={companionMotion.animate}
        transition={companionMotion.transition}
        whileTap={{ scale: 0.92 }}
        className="gpu-layer fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] right-3 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-[#0d0c16]/90 text-[#ddd6fe] shadow-[0_16px_45px_rgba(2,6,23,0.5)] backdrop-blur-xl md:hidden"
        aria-label="Open Aawax chat"
      >
        <CoachMascot mood={mascotMood} size={42} float={false} />
      </motion.button>

      <AnimatePresence>
        {mode === 'tour' ? (
          <>
            {/* Dimmer. Clicking anywhere outside Aawax leaves the tour, so the
                user is never trapped waiting for a specific button. */}
            <motion.div
              key="tour-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={completeTour}
              className="fixed inset-0 z-[65] bg-[#06060b]/55 backdrop-blur-[2px]"
              aria-hidden
            />

            {/* Always-reachable exit, fixed to the corner so it never moves
                with Aawax and is available from the very first frame. */}
            <motion.button
              key="tour-skip"
              type="button"
              onClick={completeTour}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="fixed right-4 top-4 z-[80] flex items-center gap-2 rounded-full border border-white/15 bg-[#0d0c16]/90 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe] shadow-[0_10px_40px_rgba(2,6,23,0.6)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Skip tour
              <span className="hidden text-[#6f668c] sm:inline">Esc</span>
            </motion.button>

            {/* Aawax himself: a free-standing cutout with no card around him.
                He walks between spots; the bubble is his child, so it travels
                with him instead of being repositioned separately. */}
            <motion.div
              key="tour-aawax"
              className="gpu-layer fixed z-[75]"
              initial={{ opacity: 0, scale: 0.6, left: spot.x, top: spot.y }}
              animate={{ opacity: 1, scale: 1, left: spot.x, top: spot.y }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{
                left: { type: 'spring', stiffness: 90, damping: 18, mass: 0.9 },
                top: { type: 'spring', stiffness: 90, damping: 18, mass: 0.9 },
                opacity: { duration: 0.25 },
                scale: { type: 'spring', stiffness: 260, damping: 20 },
              }}
              style={{ translateX: '-50%', translateY: '-50%' }}
            >
              <div className="relative">
                {/* Speech bubble, anchored beside Aawax and flipped to the
                    inside edge when he stands near the right of the screen. */}
                <motion.div
                  key={`bubble-${stepIndex}`}
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.12 }}
                  className={cn(
                    'absolute bottom-[calc(100%+0.9rem)] w-[min(78vw,320px)]',
                    spot.flip ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
                  )}
                >
                  <div className="relative rounded-[22px] bg-[#f4f1ff] px-4 py-3.5 text-[#25203a] shadow-[0_18px_50px_rgba(2,6,23,0.55)]">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7c6fae]">
                      {activeStep.title}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-6">
                      {typedBody}
                      <motion.span
                        className="ml-0.5 inline-block h-3.5 w-[3px] translate-y-0.5 rounded-full bg-[#7c6fae]"
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                      />
                    </p>

                    {/* Tail: three shrinking circles, the comic convention for
                        speech, pointing down at Aawax. */}
                    <div className={cn('absolute top-full flex flex-col items-center gap-1 pt-1.5', spot.flip ? 'right-7' : 'left-7')}>
                      <span className="block h-2.5 w-2.5 rounded-full bg-[#f4f1ff]" />
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#f4f1ff]" />
                    </div>
                  </div>
                </motion.div>

                {/* The cutout. A soft ground shadow sells him as standing on
                    the page rather than floating in a container. */}
                <div className="relative flex flex-col items-center">
                  <motion.div
                    onClick={boop}
                    onKeyDown={(event) => event.key === 'Enter' && boop()}
                    role="button"
                    tabIndex={0}
                    aria-label="Boop Aawax"
                    className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/70"
                    animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
                    transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <CoachMascot mood={mascotMood} size={104} float={false} />
                  </motion.div>
                  <span className="mt-1 block h-2 w-16 rounded-[50%] bg-[#06060b]/45 blur-[3px]" aria-hidden />
                </div>

                {/* Controls sit under Aawax so he stays the focus. */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={previous}
                    disabled={stepIndex === 0}
                    className="h-9 rounded-[14px] px-3 font-mono text-[10px] uppercase tracking-[0.14em]"
                  >
                    Back
                  </Button>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#a79dc8]">
                    {stepIndex + 1}/{TOUR_STEPS.length}
                  </span>
                  <Button onClick={next} className="h-9 rounded-[14px] px-4 font-mono text-[10px] uppercase tracking-[0.14em]">
                    {stepIndex === TOUR_STEPS.length - 1 ? 'Got it' : 'Next'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
