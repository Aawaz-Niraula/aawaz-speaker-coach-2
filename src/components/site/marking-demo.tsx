'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, FileText, Gauge } from 'lucide-react';

import { scoreColor, scoreGrade } from '@/lib/feedback';

/**
 * A spoken line being marked, on a loop.
 *
 * The transcript arrives as it was said, the fillers are struck and counted,
 * the pause is slashed in, the pace resolves and the score lands. It then
 * rests for four seconds and runs again, so a visitor who looks up part way
 * through still sees the whole thing.
 *
 * The loop only turns while the card is on screen. That matters: this repo
 * spent five commits removing animation that kept running behind the scroll,
 * and a permanent timer would put some of it straight back. An observer
 * starts the cycle on entry and tears it down on exit, so the cost is zero
 * for every part of the page a visitor is not looking at.
 *
 * Only opacity, transform and colour animate, and every mark holds its space
 * from the first render, so there is no layout work and no layout shift.
 * Reduced motion gets the finished state and no timers at all.
 */

type Token =
  | { kind: 'word'; text: string }
  | { kind: 'filler'; text: string }
  | { kind: 'pause' };

const TOKENS: Token[] = [
  { kind: 'filler', text: 'So,' },
  { kind: 'filler', text: 'um,' },
  { kind: 'word', text: 'the' },
  { kind: 'word', text: 'morning' },
  { kind: 'word', text: 'my' },
  { kind: 'word', text: 'sister' },
  { kind: 'word', text: 'missed' },
  { kind: 'word', text: 'her' },
  { kind: 'word', text: 'bus' },
  { kind: 'pause' },
  { kind: 'word', text: 'she' },
  { kind: 'word', text: 'walked' },
  { kind: 'word', text: 'four' },
  { kind: 'word', text: 'kilometres' },
  { kind: 'word', text: 'to' },
  { kind: 'word', text: 'school.' },
];

const FILLER_COUNT = TOKENS.filter((token) => token.kind === 'filler').length;

/** A different mark from the report shown further down, which lands on 68. */
const SCORE = 74;

/** Milliseconds from the start of a cycle to each stage landing. */
const STAGE_AT = [0, 480, 1080, 1560, 1980] as const;
const SEQUENCE_MS = 2900;
/** How long the finished mark rests on screen before the next run. */
const REST_MS = 4000;
/** Steps in the count up, and how long it takes. */
const COUNT_STEPS = 16;
const COUNT_MS = 850;
const CYCLE_MS = SEQUENCE_MS + REST_MS;
/**
 * Nothing moves for this long after the card appears. The headline beside it
 * has to win the first look, and motion always wins a salience contest, so
 * the demo simply does not enter one until the reader has arrived.
 */
const LEAD_IN_MS = 1400;

/** Muted rather than alarm red: it marks a filler, it does not raise an error. */
const MARK_COLOUR = '#e3929f';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readMotion = () => window.matchMedia(MOTION_QUERY).matches;
const readMotionOnServer = () => false;

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const GRADE = scoreGrade(SCORE);
const SCORE_COLOR = scoreColor(SCORE);

export function MarkingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  /** True once the card has been seen, so a re-entry resumes rather than waits. */
  const seenRef = useRef(false);
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState(0);
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, readMotionOnServer);

  const settled = reduceMotion ? 4 : stage;
  const score = reduceMotion ? SCORE : shown;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    // Without these the sweep and the dot stay lit for the rest of the session
    // when the card leaves view mid pass, and the mark is left frozen at
    // whatever partial value it had reached.
    setRunning(false);
    setStage(0);
    setShown(0);
  }, []);

  /** One pass, then a rest, then another, for as long as the card is visible. */
  const startCycle = useCallback(() => {
    clearTimers();

    const runOnce = () => {
      timersRef.current = [];
      setRunning(true);
      setShown(0);
      STAGE_AT.forEach((delay, index) => {
        timersRef.current.push(window.setTimeout(() => setStage(index), delay));
      });

      // Sixteen steps rather than a frame loop: few enough that the renders are
      // negligible, and the final step lands on the exact mark by construction.
      for (let step = 1; step <= COUNT_STEPS; step += 1) {
        const progress = step / COUNT_STEPS;
        const eased = 1 - (1 - progress) ** 3;
        timersRef.current.push(
          window.setTimeout(
            () => setShown(Math.round(eased * SCORE)),
            STAGE_AT[4] + progress * COUNT_MS,
          ),
        );
      }
      timersRef.current.push(window.setTimeout(() => setRunning(false), SEQUENCE_MS));
      timersRef.current.push(window.setTimeout(runOnce, CYCLE_MS));
    };

    if (seenRef.current) {
      runOnce();
      return;
    }

    seenRef.current = true;
    timersRef.current.push(window.setTimeout(runOnce, LEAD_IN_MS));
  }, [clearTimers]);

  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Scheduled rather than called, so the effect body itself sets no state.
      const boot = window.setTimeout(startCycle, 0);
      return () => {
        window.clearTimeout(boot);
        clearTimers();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Stop the loop the moment the card leaves the viewport, so nothing
        // runs behind the rest of the page.
        if (entries.some((entry) => entry.isIntersecting)) startCycle();
        else clearTimers();
      },
      { threshold: 0.15 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      clearTimers();
    };
  }, [startCycle, clearTimers, reduceMotion]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#131120_0%,#0b0b12_60%)] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-6"
    >
      {/* A sweep across the top edge while a pass is running. It is the cue
          that this is live rather than a still, and it costs one transform. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <span
          className="block h-px w-full origin-left bg-[linear-gradient(90deg,transparent,#a78bfa,#f9a8d4,transparent)] transition-transform duration-[2900ms] ease-linear"
          style={{ transform: running ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </span>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[#f9a8d4] transition-opacity duration-500"
          style={{ opacity: running ? 1 : 0.35 }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#857ca2]">Marking</span>
      </div>

      <p className="mt-4 text-lg leading-[1.85] text-[#f2efff] sm:text-xl">
        {TOKENS.map((token, index) => {
          if (token.kind === 'pause') {
            return (
              <span
                key={index}
                aria-hidden
                className="inline-block px-1 font-mono text-[#f9a8d4] transition-opacity duration-500"
                style={{ opacity: settled >= 2 ? 1 : 0 }}
              >
                /
              </span>
            );
          }

          const marked = token.kind === 'filler' && settled >= 1;

          return (
            <span
              key={index}
              className="transition-colors duration-500"
              style={{
                color: marked ? MARK_COLOUR : undefined,
                textDecoration: marked ? 'line-through' : undefined,
                textDecorationColor: marked ? 'rgba(227,146,159,0.6)' : undefined,
              }}
            >
              {token.text}{' '}
            </span>
          );
        })}
      </p>

      <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
        <Measure
          show={settled >= 1}
          icon={<AudioLines className="h-3.5 w-3.5" />}
          label="Filler words"
          value={String(FILLER_COUNT)}
        />
        <Measure
          show={settled >= 2}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Pauses"
          value={'1 clear gap after “bus”'}
        />
        <Measure
          show={settled >= 3}
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Speaking speed"
          value="152 words/min"
        />

        <div
          className="mt-0.5 flex items-center gap-4 rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.12),rgba(249,168,212,0.07))] px-4 py-3 transition-all duration-500"
          style={{
            opacity: settled >= 4 ? 1 : 0,
            transform: settled >= 4 ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <svg viewBox="0 0 100 100" className="h-[56px] w-[56px] shrink-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="url(#marking-demo-ring)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - score / 100)}
            />
            <defs>
              <linearGradient id="marking-demo-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={SCORE_COLOR} />
                <stop offset="100%" stopColor="#f9a8d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="min-w-0">
            <p className="font-serif text-[1.75rem] leading-none text-white tabular-nums">
              {score}
              <span className="font-mono text-sm text-[#b3a9cf]">/100</span>
            </p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: SCORE_COLOR }}>
              {GRADE.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Measure({
  show,
  icon,
  label,
  value,
}: {
  show: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-[18px] border border-white/[0.07] bg-white/[0.035] px-4 py-2.5 transition-all duration-500"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-[8px] bg-[#a78bfa]/15 text-[#a78bfa]">
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe]">{label}</span>
      </div>
      <p className="mt-1 text-[15px] text-[#f2efff]">{value}</p>
    </div>
  );
}
