'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';
import { Map, Volume2, VolumeX, X } from 'lucide-react';

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

type TourSpot = {
  x: string;
  y: string;
  /** Bubble sits on the left of Aawax (he is near the right edge). */
  flip: boolean;
  /** Bubble hangs below Aawax instead of above (he is near the top edge). */
  below?: boolean;
};

/**
 * Where Aawax stands for each tour step.
 *
 * He walks to these spots and the bubble is anchored to him, so it travels
 * with him. `flip` and `below` keep the bubble inside the viewport: without
 * `below`, a spot near the top pushes the bubble off the top of the screen.
 *
 * Desktop spots avoid the top-right corner, which holds both the page's own
 * header buttons and the fixed Skip control.
 */
const TOUR_SPOTS: Record<CompanionPosition, TourSpot> = {
  'bottom-right': { x: 'calc(100vw - 12rem)', y: 'calc(100vh - 13rem)', flip: true },
  'bottom-left': { x: '7rem', y: 'calc(100vh - 13rem)', flip: false },
  'top-right': { x: 'calc(100vw - 13rem)', y: '11rem', flip: true, below: true },
  center: { x: '50vw', y: '52vh', flip: false },
  side: { x: 'calc(100vw - 12rem)', y: '50vh', flip: true },
};

/**
 * Mobile spots. Phones are too narrow for a left/right dance, so Aawax stays
 * horizontally centred and only moves vertically, well clear of the bottom
 * nav bar and the fixed Skip button.
 */
const TOUR_SPOTS_MOBILE: Record<CompanionPosition, TourSpot> = {
  'bottom-right': { x: '50vw', y: 'calc(100vh - 15rem)', flip: false },
  'bottom-left': { x: '50vw', y: 'calc(100vh - 15rem)', flip: false },
  'top-right': { x: '50vw', y: '13rem', flip: false, below: true },
  center: { x: '50vw', y: '54vh', flip: false },
  side: { x: '50vw', y: '54vh', flip: false },
};

const TOUR_STORAGE_KEY = 'aawax-onboarding-v1';
const TOUR_MUTE_KEY = 'aawax-tour-muted';

const TOUR_STEPS: TourStep[] = [
  {
    tab: 'coach',
    title: "Hi, I'm Aawax",
    body: "Pick a format first. General works for any speech, or choose a template and I'll hold you to that exact structure.",
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Speech format',
  },
  {
    tab: 'coach',
    title: 'Then just talk',
    body: "Tap the mic and say your piece. I'm listening to your pacing, how clearly you speak, and every um and uh. Sorry in advance.",
    mood: 'talk',
    position: 'center',
    targetLabel: 'Recorder',
  },
  {
    tab: 'coach',
    title: 'Your feedback',
    body: "You'll get a score and a list of fixes. Everyone stares at the score, but the fixes are the part that makes you better.",
    mood: 'talk',
    position: 'bottom-left',
    targetLabel: 'Feedback report',
  },
  {
    tab: 'speech',
    title: 'Need something to practise?',
    body: "Give me a topic and I'll write you a speech. I can read it back too, in four different accents.",
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Speech generator',
  },
  {
    tab: 'history',
    title: 'Everything you record',
    body: "It all gets saved here. Open a couple side by side and you'll spot the mistake you keep making. That's the one to fix.",
    mood: 'talk',
    position: 'top-right',
    targetLabel: 'History',
  },
  {
    tab: 'progress',
    title: 'My favourite page',
    body: "Your scores over time, and what to work on next. Some days the number barely moves. That still counts.",
    mood: 'talk',
    position: 'bottom-right',
    targetLabel: 'Progress',
  },
  {
    tab: 'account',
    title: "That's everything",
    body: "Make an account so none of this disappears. And if you don't like how I look, you can change that here too.",
    mood: 'talk',
    position: 'bottom-left',
    targetLabel: 'Account and customisation',
  },
];

/**
 * Tracks the phone breakpoint without a setState-in-effect cascade.
 * The server snapshot is `false` so SSR renders the desktop layout and
 * hydration stays clean.
 */
const NARROW_QUERY = '(max-width: 767px)';

function subscribeToNarrow(listener: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function useIsNarrow() {
  return useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

/**
 * Types the line out character by character.
 *
 * `durationMs` lets the caller stretch the typing to match Aawax's narration,
 * so the words appear roughly as he says them instead of racing ahead and
 * leaving him talking to already-finished text.
 */
function useTypewriter(text: string, active: boolean, durationMs?: number) {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!active || reduceMotion) {
      return;
    }

    // Leave a tail of silence so the text finishes a beat before he does.
    const perChar = durationMs && text.length
      ? Math.max(12, Math.min(90, (durationMs * 0.82) / text.length))
      : 26;

    let index = 0;
    const interval = window.setInterval(() => {
      setDisplayed(text.slice(0, index));
      index += 1;
      if (index >= text.length) {
        window.clearInterval(interval);
      }
    }, perChar);

    return () => window.clearInterval(interval);
  }, [active, reduceMotion, text, durationMs]);

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
  // Mute is remembered so a user who silenced Aawax stays silenced. Read
  // lazily rather than in an effect to avoid a hydration-time re-render.
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(TOUR_MUTE_KEY) === 'muted';
    } catch {
      return false;
    }
  });
  const isNarrow = useIsNarrow();
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  /* Drives the typewriter pace and the talking mouth, so both follow the
     narration rather than running on their own clock. Both are stamped with
     the step they belong to, so moving to the next step invalidates them
     without needing an effect to reset state. */
  const [narration, setNarration] = useState<{ step: number; durationMs?: number; speaking: boolean }>({
    step: -1,
    speaking: false,
  });
  const lineDuration = narration.step === stepIndex ? narration.durationMs : undefined;
  const speaking = narration.step === stepIndex && narration.speaking;

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
  const typedBody = useTypewriter(activeStep.body, mode === 'tour', lineDuration);
  const isBusy = flags.isRecording || flags.isAnalyzing || flags.isGenerating || flags.isVoiceBusy;

  useEffect(() => {
    if (mode === 'tour') {
      onTabChange(activeStep.tab);
    }
  }, [activeStep.tab, mode, onTabChange]);

  const spot = (isNarrow ? TOUR_SPOTS_MOBILE : TOUR_SPOTS)[activeStep.position];

  /* Narration. The tour script is fixed, so the lines are pre-rendered with
     Aawax's voice and shipped as static files: no API call, no credits, and
     no wait before he starts talking. */
  useEffect(() => {
    if (mode !== 'tour') {
      narrationRef.current?.pause();
      narrationRef.current = null;
      return;
    }

    narrationRef.current?.pause();

    if (muted) {
      narrationRef.current = null;
      return;
    }

    const step = stepIndex;
    const audio = new Audio(`/tour/tour-${step + 1}.mp3`);
    audio.volume = 0.85;
    narrationRef.current = audio;

    const onPlaying = () => setNarration((n) => ({ ...n, step, speaking: true }));
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setNarration((n) => ({ ...n, step, durationMs: audio.duration * 1000 }));
      }
    };
    const onEnded = () => setNarration((n) => ({ ...n, step, speaking: false }));

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);

    // Autoplay can be blocked until the user interacts with the page; the
    // tour still reads fine silently, so a rejection is not worth surfacing.
    void audio.play().catch(() => null);

    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [mode, stepIndex, muted]);

  // Never leave Aawax talking after the tour closes.
  useEffect(() => () => narrationRef.current?.pause(), []);

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(TOUR_MUTE_KEY, next ? 'muted' : 'on');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

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
    // Mouth only moves while he is actually mid-line. Once the audio ends he
    // settles into a smile instead of chewing on silence. When muted there is
    // no audio to follow, so the typewriter stands in for the talking.
    if (mode === 'tour' && !speaking && !muted) return 'idle';
    return activeStep.mood;
  }, [activeStep.mood, boopCount, flags.isAnalyzing, flags.isGenerating, flags.isRecording, flags.isVoiceBusy, isBusy, mode, speaking, muted]);

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

            {/* Mute and exit, fixed to the corner so they never move with
                Aawax and are available from the very first frame. */}
            <motion.div
              key="tour-controls"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="fixed right-3 top-3 z-[80] flex items-center gap-2 sm:right-4 sm:top-4"
            >
              <button
                type="button"
                onClick={toggleMute}
                aria-pressed={muted}
                aria-label={muted ? 'Unmute Aawax' : 'Mute Aawax'}
                title={muted ? 'Unmute Aawax' : 'Mute Aawax'}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#0d0c16]/90 text-[#ddd6fe] shadow-[0_10px_40px_rgba(2,6,23,0.6)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={completeTour}
                className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-[#0d0c16]/90 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe] shadow-[0_10px_40px_rgba(2,6,23,0.6)] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                Skip
                <span className="hidden text-[#6f668c] sm:inline">Esc</span>
              </button>
            </motion.div>

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
                    'absolute w-[min(80vw,320px)]',
                    // Hang below Aawax when he stands near the top, otherwise
                    // the bubble would be clipped off the viewport.
                    spot.below ? 'top-[calc(100%+0.9rem)]' : 'bottom-[calc(100%+0.9rem)]',
                    spot.flip ? 'right-0' : 'left-0',
                    // On phones Aawax is centred, so centre the bubble on him.
                    isNarrow && 'left-1/2 right-auto -translate-x-1/2',
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

                    {/* Tail: shrinking circles, the comic convention for
                        speech, pointing back toward Aawax. */}
                    <div
                      className={cn(
                        'absolute flex flex-col items-center gap-1',
                        spot.below ? 'bottom-full flex-col-reverse pb-1.5' : 'top-full pt-1.5',
                        isNarrow ? 'left-1/2 -translate-x-1/2' : spot.flip ? 'right-7' : 'left-7',
                      )}
                    >
                      <span className="block h-2.5 w-2.5 rounded-full bg-[#f4f1ff]" />
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#f4f1ff]" />
                    </div>
                  </div>

                  {/* With the bubble below Aawax, the controls belong under the
                      bubble — anchoring them to it keeps them clear whatever
                      the text length. */}
                  {spot.below ? (
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
                  ) : null}
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
                    <CoachMascot mood={mascotMood} size={isNarrow ? 84 : 104} float={false} />
                  </motion.div>
                  <span className="mt-1 block h-2 w-14 rounded-[50%] bg-[#06060b]/45 blur-[3px] sm:w-16" aria-hidden />
                </div>

                {/* Controls sit under Aawax so he stays the focus. When the
                    bubble hangs below him it occupies that space, so the
                    controls render inside the bubble wrapper instead (see
                    below) and this row is skipped entirely. */}
                <div className={cn('flex items-center justify-center gap-2 mt-3', spot.below && 'hidden')}>
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
