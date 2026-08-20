'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Mic,
  Minus,
  Play,
  Plus,
  Square,
  X,
} from 'lucide-react';

import { CoachMascot } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import { formatClock } from '@/lib/feedback';
import {
  getRehearsalSegmentIndex,
  rehearsalEstimatedSeconds,
  segmentRehearsalScript,
  type RehearsalScript,
  type RehearsalSpeed,
} from '@/lib/rehearsal';
import { cn } from '@/lib/utils';

type TextSize = 'compact' | 'comfortable' | 'large';

const TEXT_SIZE_CLASSES: Record<TextSize, string> = {
  compact: 'text-lg leading-8 sm:text-xl sm:leading-9',
  comfortable: 'text-xl leading-9 sm:text-2xl sm:leading-10',
  large: 'text-2xl leading-10 sm:text-3xl sm:leading-[1.45]',
};

const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  large: 'Large',
};

const SPEED_OPTIONS: { id: RehearsalSpeed; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'steady', label: 'Steady' },
  { id: 'brisk', label: 'Brisk' },
];

export function RehearsalReadyCard({
  rehearsal,
  onOpen,
  onDismiss,
  disabled,
}: {
  rehearsal: RehearsalScript;
  onOpen: () => void;
  onDismiss: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.14),rgba(249,168,212,0.08))] p-4 shadow-[0_14px_40px_rgba(2,6,23,0.24)] sm:rounded-[26px] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#a78bfa]/15 text-[#ddd6fe]">
            <BookOpenText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ddd6fe]">Guided rehearsal ready</p>
            <p className="mt-1 truncate font-serif text-xl tracking-tight text-white">{rehearsal.topic}</p>
            <p className="mt-1 text-sm leading-6 text-[#a79dc8]">{rehearsal.templateLabel} · Read with a line-following teleprompter</p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-[1fr,auto] gap-2 sm:flex">
          <Button onClick={onOpen} disabled={disabled} className="h-11 rounded-[16px] px-5 font-mono text-[11px] uppercase tracking-[0.16em]">
            <Mic className="h-4 w-4" />
            Open script
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss} disabled={disabled} className="h-11 w-11 rounded-[16px]" aria-label="Dismiss guided rehearsal">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GuidedRehearsal({
  open,
  rehearsal,
  isRecording,
  seconds,
  maxSeconds,
  onStart,
  onStop,
  onClose,
}: {
  open: boolean;
  rehearsal: RehearsalScript | null;
  isRecording: boolean;
  seconds: number;
  maxSeconds: number;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [speed, setSpeed] = useState<RehearsalSpeed>('steady');
  const [textSize, setTextSize] = useState<TextSize>('comfortable');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [anchorSecond, setAnchorSecond] = useState(0);
  const scriptScrollRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeBlockedRef = useRef(false);
  const closeActionRef = useRef<() => void>(() => undefined);
  const mobileControlsOpenRef = useRef(false);
  const mobileControlsButtonRef = useRef<HTMLButtonElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const scrollReleaseRef = useRef<number | null>(null);

  const segments = useMemo(
    () => segmentRehearsalScript(rehearsal?.script ?? ''),
    [rehearsal?.script],
  );

  const currentIndex = isRecording
    ? getRehearsalSegmentIndex(segments, seconds - anchorSecond, speed, anchorIndex)
    : anchorIndex;
  const estimatedSeconds = rehearsalEstimatedSeconds(segments, speed);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    mobileControlsOpenRef.current = mobileControlsOpen;
  }, [mobileControlsOpen]);

  useEffect(() => {
    if (!open || countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
        return;
      }
      setCountdown(null);
      setAnchorIndex(0);
      setAnchorSecond(0);
      setAutoFollow(true);
      setIsStarting(true);
      void Promise.resolve(onStart()).finally(() => setIsStarting(false));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [countdown, onStart, open]);

  useEffect(() => {
    if (!open || !autoFollow) return;
    const scrollActiveLine = (behavior: ScrollBehavior) => {
      const container = scriptScrollRef.current;
      const activeLine = container?.querySelector<HTMLElement>('[aria-current="step"]') ?? null;
      if (!container || !activeLine) return;
      programmaticScrollRef.current = true;
      if (scrollReleaseRef.current !== null) window.clearTimeout(scrollReleaseRef.current);
      dialogRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      container.scrollTo({
        top: Math.max(0, activeLine.offsetTop - ((container.clientHeight - activeLine.clientHeight) / 2)),
        behavior,
      });
      scrollReleaseRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
        scrollReleaseRef.current = null;
      }, behavior === 'smooth' ? 700 : 120);
    };
    const focusFrame = window.requestAnimationFrame(() => {
      scrollActiveLine(reduceMotion ? 'auto' : 'smooth');
    });
    const handleResize = () => scrollActiveLine('auto');
    const resizeObserver = new ResizeObserver(handleResize);
    if (scriptScrollRef.current) resizeObserver.observe(scriptScrollRef.current);
    const renderedActiveLine = scriptScrollRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (renderedActiveLine) resizeObserver.observe(renderedActiveLine);
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (scrollReleaseRef.current !== null) window.clearTimeout(scrollReleaseRef.current);
    };
  }, [autoFollow, currentIndex, open, reduceMotion]);

  const pauseAutoFollow = () => {
    if (scrollReleaseRef.current !== null) {
      window.clearTimeout(scrollReleaseRef.current);
      scrollReleaseRef.current = null;
    }
    programmaticScrollRef.current = false;
    const container = scriptScrollRef.current;
    if (container) container.scrollTo({ top: container.scrollTop, behavior: 'auto' });
    setAutoFollow(false);
    setMobileControlsOpen(false);
  };

  const moveTo = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(segments.length - 1, nextIndex));
    setAnchorIndex(safeIndex);
    setAnchorSecond(seconds);
    setAutoFollow(true);
  };

  const adjustTextSize = (direction: -1 | 1) => {
    const sizes: TextSize[] = ['compact', 'comfortable', 'large'];
    const next = Math.max(0, Math.min(sizes.length - 1, sizes.indexOf(textSize) + direction));
    setTextSize(sizes[next]);
  };

  const stopAndClose = () => {
    if (isStarting) return;
    setCountdown(null);
    setAnchorIndex(0);
    setAnchorSecond(0);
    setAutoFollow(true);
    setMobileControlsOpen(false);
    if (isRecording) onStop();
    onClose();
  };

  useEffect(() => {
    closeBlockedRef.current = isRecording || isStarting;
    closeActionRef.current = stopAndClose;
  });

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => startButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileControlsOpenRef.current) {
          event.preventDefault();
          setMobileControlsOpen(false);
          window.requestAnimationFrame(() => mobileControlsButtonRef.current?.focus());
          return;
        }
        if (!closeBlockedRef.current) {
          event.preventDefault();
          closeActionRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => (
        element.getAttribute('aria-hidden') !== 'true'
        && element.getClientRects().length > 0
      ));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && rehearsal ? (
        <div className="fixed inset-0 z-[80]">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#05050a]/85 backdrop-blur-xl"
            onClick={isRecording || isStarting ? undefined : stopAndClose}
            aria-label="Close guided rehearsal"
          />

          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Guided rehearsal for ${rehearsal.topic}`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.985 }}
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden border-white/10 bg-[radial-gradient(circle_at_50%_-10%,rgba(167,139,250,0.22),transparent_38%),#090810] md:inset-5 md:rounded-[30px] md:border md:shadow-[0_36px_100px_rgba(0,0,0,0.72)] lg:inset-x-[max(2rem,calc((100vw-1180px)/2))]"
          >
            <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0b0a13]/80 px-3 py-3 backdrop-blur-xl sm:px-5 md:rounded-t-[30px]">
              <div className="flex min-w-0 items-center gap-3">
                <CoachMascot mood={isRecording ? 'coach' : 'cheer'} size={44} float={false} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg tracking-tight text-white sm:text-xl">{rehearsal.topic}</p>
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[#a79dc8] sm:text-[10px]">{rehearsal.templateLabel}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className={cn(
                  'hidden items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] sm:flex',
                  isRecording ? 'border-[#f87171]/30 bg-[#dc2626]/12 text-[#fca5a5]' : 'border-white/10 bg-white/5 text-[#a79dc8]',
                )}>
                  <span className={cn('h-2 w-2 rounded-full', isRecording ? 'animate-pulse bg-[#f87171]' : 'bg-[#4ade80]')} />
                  {isRecording ? `Recording ${formatClock(seconds)}` : isStarting ? 'Opening microphone' : `About ${formatClock(estimatedSeconds)}`}
                </div>
                <Button variant="ghost" size="icon" onClick={stopAndClose} disabled={isStarting} className="h-11 w-11 rounded-full" aria-label={isRecording ? 'End rehearsal' : 'Close rehearsal'}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_230px] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
              <div
                ref={scriptScrollRef}
                role="region"
                aria-label="Rehearsal script"
                tabIndex={0}
                className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 md:px-12 lg:px-16"
                onWheel={pauseAutoFollow}
                onTouchMove={pauseAutoFollow}
                onPointerDown={pauseAutoFollow}
                onKeyDown={(event) => {
                  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
                    pauseAutoFollow();
                  }
                }}
                onScroll={() => {
                  if (!programmaticScrollRef.current) setAutoFollow(false);
                }}
              >
                {!autoFollow ? (
                  <div className="pointer-events-none sticky top-3 z-20 flex h-0 justify-center" aria-live="polite">
                    <button
                      type="button"
                      onClick={() => setAutoFollow(true)}
                      className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-[#a78bfa]/35 bg-[#11101c]/95 px-4 font-mono text-[9px] uppercase tracking-[0.14em] text-[#ddd6fe] shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-[#1a1729] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090810]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Resume auto-follow
                    </button>
                  </div>
                ) : null}
                <div className="h-[34vh] shrink-0 [@media(min-width:768px)_and_(max-height:500px)]:h-8" aria-hidden="true" />
                <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
                  {segments.map((segment, index) => {
                    const active = index === currentIndex;
                    const past = index < currentIndex;
                    return (
                      <motion.div
                        key={segment.id}
                        animate={{ opacity: active ? 1 : past ? 0.32 : 0.5, scale: active ? 1 : 0.985 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25 }}
                        className={cn(
                          'scroll-my-[35vh] rounded-[22px] border px-5 py-5 transition-colors sm:rounded-[26px] sm:px-7 sm:py-6 [@media(min-width:768px)_and_(max-height:500px)]:px-5 [@media(min-width:768px)_and_(max-height:500px)]:py-3',
                          active
                            ? 'border-[#a78bfa]/45 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.09))] shadow-[0_18px_50px_rgba(167,139,250,0.16)]'
                            : 'border-transparent bg-transparent',
                        )}
                        aria-current={active ? 'step' : undefined}
                      >
                        {segment.cues.length ? (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {segment.cues.map((cue, cueIndex) => (
                              <span key={`${cue}-${cueIndex}`} className="rounded-full border border-[#f9a8d4]/20 bg-[#f9a8d4]/8 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#fbcfe8]">
                                {cue}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className={cn('font-serif tracking-[-0.015em] text-[#f2efff] [@media(min-width:768px)_and_(max-height:500px)]:text-xl [@media(min-width:768px)_and_(max-height:500px)]:leading-8', TEXT_SIZE_CLASSES[textSize])}>{segment.spokenText}</p>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="h-[34vh] shrink-0 [@media(min-width:768px)_and_(max-height:500px)]:h-8" aria-hidden="true" />

                <AnimatePresence>
                  {countdown !== null ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.15 }}
                      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-black/45 backdrop-blur-sm"
                      aria-live="assertive"
                    >
                      <div className="grid h-32 w-32 place-items-center rounded-full border border-[#a78bfa]/40 bg-[#0d0c16]/95 font-serif text-7xl text-white shadow-[0_0_70px_rgba(167,139,250,0.5)]">
                        {countdown || <Mic className="h-12 w-12" />}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <aside className="hidden min-h-0 border-l border-white/10 bg-white/[0.025] p-4 md:flex md:flex-col md:gap-5 md:overflow-y-auto">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#857ca2]">Line pace</p>
                  <div className="mt-2 grid gap-1.5">
                    {SPEED_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSpeed(option.id)}
                        disabled={isRecording}
                        className={cn(
                          'flex h-11 items-center justify-between rounded-[14px] border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] disabled:opacity-50',
                          speed === option.id ? 'border-[#a78bfa]/35 bg-[#a78bfa]/12 text-white' : 'border-white/8 bg-white/4 text-[#a79dc8] hover:bg-white/8',
                        )}
                        aria-pressed={speed === option.id}
                      >
                        {option.label}
                        <Gauge className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#857ca2]">Text size</p>
                  <div className="mt-2 grid grid-cols-[44px_1fr_44px] items-center gap-2">
                    <Button variant="secondary" size="icon" onClick={() => adjustTextSize(-1)} disabled={textSize === 'compact'} className="h-11 w-11 rounded-[14px]" aria-label="Decrease teleprompter text size"><Minus className="h-4 w-4" /></Button>
                    <span className="text-center text-sm text-[#ddd6fe]">{TEXT_SIZE_LABELS[textSize]}</span>
                    <Button variant="secondary" size="icon" onClick={() => adjustTextSize(1)} disabled={textSize === 'large'} className="h-11 w-11 rounded-[14px]" aria-label="Increase teleprompter text size"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="mt-auto rounded-[18px] border border-white/8 bg-white/4 p-3">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#ddd6fe]">
                    <span className={cn('h-2 w-2 rounded-full', autoFollow ? 'bg-[#4ade80]' : 'bg-[#f9a8d4]')} />
                    Auto-follow {autoFollow ? 'on' : 'paused'}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#a79dc8]">
                    Scroll whenever you need to look ahead. The highlight will wait for you.
                  </p>
                  {!autoFollow ? (
                    <Button variant="secondary" onClick={() => setAutoFollow(true)} className="mt-3 h-11 w-full rounded-[14px] text-xs">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Resume following
                    </Button>
                  ) : null}
                </div>
              </aside>
            </div>

            <footer className="relative z-10 shrink-0 border-t border-white/10 bg-[#0b0a13]/92 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl sm:px-5 md:rounded-b-[30px] md:pb-3">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 font-mono text-[9px] tabular-nums text-[#857ca2]">
                      <span className="uppercase tracking-[0.14em]">Line {Math.min(currentIndex + 1, segments.length)} of {segments.length}</span>
                      <span className="truncate text-right">
                        {isRecording ? `${formatClock(seconds)} / ${formatClock(maxSeconds)}` : isStarting ? 'Opening microphone…' : `About ${formatClock(estimatedSeconds)}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] transition-[width] duration-300" style={{ width: `${segments.length ? ((currentIndex + 1) / segments.length) * 100 : 0}%` }} />
                    </div>
                  </div>

                  <button
                    ref={mobileControlsButtonRef}
                    type="button"
                    onClick={() => setMobileControlsOpen((current) => !current)}
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border font-serif text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090810] md:hidden',
                      mobileControlsOpen ? 'border-[#a78bfa]/40 bg-[#a78bfa]/15 text-white' : 'border-white/10 bg-white/5 text-[#ddd6fe]',
                    )}
                    aria-label={`Reading settings. ${speed} pace, ${TEXT_SIZE_LABELS[textSize].toLowerCase()} text`}
                    aria-controls="mobile-reading-settings"
                    aria-expanded={mobileControlsOpen}
                    title="Reading settings"
                  >
                    Aa
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center justify-center gap-2 md:grid-cols-[44px_minmax(220px,320px)_44px]">
                  <Button variant="secondary" size="icon" onClick={() => moveTo(currentIndex - 1)} disabled={currentIndex === 0 || countdown !== null} className="h-11 w-11 rounded-[15px]" aria-label="Previous script line">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <Button
                    ref={startButtonRef}
                    onClick={() => {
                      if (isRecording) {
                        stopAndClose();
                      } else {
                        setAutoFollow(true);
                        setMobileControlsOpen(false);
                        setCountdown(3);
                      }
                    }}
                    disabled={countdown !== null || isStarting || !segments.length}
                    variant={isRecording ? 'danger' : 'primary'}
                    className="h-11 w-full rounded-[15px] px-3 font-mono text-[10px] uppercase tracking-[0.14em] sm:px-6 sm:text-[11px]"
                  >
                    {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="hidden min-[360px]:inline">{isRecording ? 'Stop & analyze' : isStarting ? 'Opening mic…' : 'Start rehearsal'}</span>
                    <span className="min-[360px]:hidden">{isRecording ? 'Stop' : isStarting ? 'Wait…' : 'Start'}</span>
                  </Button>

                  <Button variant="secondary" size="icon" onClick={() => moveTo(currentIndex + 1)} disabled={currentIndex >= segments.length - 1 || countdown !== null} className="h-11 w-11 rounded-[15px]" aria-label="Next script line">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <AnimatePresence>
                  {mobileControlsOpen ? (
                    <motion.div
                      id="mobile-reading-settings"
                      role="group"
                      aria-label="Reading settings"
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.985 }}
                      className="absolute bottom-[calc(100%+0.5rem)] left-3 right-3 max-h-[min(55vh,300px)] overflow-y-auto rounded-[22px] border border-[#a78bfa]/25 bg-[#11101c]/98 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl md:hidden"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-serif text-lg text-white">Reading settings</p>
                          <p className="mt-0.5 text-xs text-[#857ca2]">Make the script comfortable to follow.</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setMobileControlsOpen(false);
                            window.requestAnimationFrame(() => mobileControlsButtonRef.current?.focus());
                          }}
                          className="h-11 w-11 shrink-0 rounded-full"
                          aria-label="Close reading settings"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#857ca2]">Line pace</p>
                          {isRecording ? <span className="text-[10px] text-[#857ca2]">Locked while recording</span> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {SPEED_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSpeed(option.id)}
                              disabled={isRecording}
                              className={cn(
                                'h-11 rounded-[14px] border px-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] disabled:opacity-45',
                                speed === option.id ? 'border-[#a78bfa]/40 bg-[#a78bfa]/15 text-white' : 'border-white/10 bg-white/5 text-[#a79dc8]',
                              )}
                              aria-pressed={speed === option.id}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#857ca2]">Text size</p>
                          <p className="mt-1 text-sm text-[#ddd6fe]">{TEXT_SIZE_LABELS[textSize]}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="secondary" size="icon" onClick={() => adjustTextSize(-1)} disabled={textSize === 'compact'} className="h-11 w-11 rounded-[14px]" aria-label="Decrease teleprompter text size"><Minus className="h-4 w-4" /></Button>
                          <Button variant="secondary" size="icon" onClick={() => adjustTextSize(1)} disabled={textSize === 'large'} className="h-11 w-11 rounded-[14px]" aria-label="Increase teleprompter text size"><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>

                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </footer>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
