'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, ChevronDown, FileText, Gauge, Pause, Play } from 'lucide-react';

import { scoreColor, scoreGrade } from '@/lib/feedback';
import { LandingAawax } from './landing-aawax';
import { GlassSurface } from './glass-surface';

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
  { kind: 'filler', text: 'Um,' },
  { kind: 'filler', text: 'so,' },
  { kind: 'word', text: 'everyone, plastic is bad for our health' },
  { kind: 'pause' },
  { kind: 'word', text: 'because,' },
  { kind: 'filler', text: 'uh,' },
  { kind: 'word', text: 'we use it all the time and it ends up everywhere.' },
];

// Fact-checked against UNEP's ocean estimate and WHO's exposure review.
// Pause marks are delivery suggestions, not measurements from an audio clip.
const TIGHTENED = [
  'Every minute, about a truckload of plastic enters the ocean.',
  'Microplastics have been found in our food, water and air.',
  'What we throw away comes back to us.',
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
const COMPACT_QUERY = '(max-width: 760px)';
function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readCompact = () => window.matchMedia(COMPACT_QUERY).matches;

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const GRADE = scoreGrade(SCORE);
const SCORE_COLOR = scoreColor(SCORE);

export function MarkingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  /** True once the card has been seen, so a re-entry resumes rather than waits. */
  const seenRef = useRef(false);
  const [stage, setStage] = useState(4);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState(SCORE);
  const [paused, setPaused] = useState(false);
  const [rewritten, setRewritten] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const compact = useSyncExternalStore(subscribeCompact, readCompact, readMotionOnServer);
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, readMotionOnServer);

  const settled = reduceMotion || paused || rewritten ? 4 : stage;
  const score = reduceMotion || paused || rewritten ? SCORE : shown;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    // Without these the sweep and the dot stay lit for the rest of the session
    // when the card leaves view mid pass, and the mark is left frozen at
    // whatever partial value it had reached.
    setRunning(false);
    setStage(4);
    setShown(SCORE);
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
    if (!element || reduceMotion || paused || rewritten) return;

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
  }, [startCycle, clearTimers, reduceMotion, paused, rewritten]);

  return (
    <div
      ref={ref}
      className="marking-demo relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#131120_0%,#0b0b12_60%)] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-6"
    >
      {/* A sweep across the top edge while a pass is running. It is the cue
          that this is live rather than a still, and it costs one transform. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <span
          className="block h-px w-full origin-left bg-[linear-gradient(90deg,transparent,#a78bfa,#f9a8d4,transparent)] transition-transform duration-[2900ms] ease-linear"
          style={{ transform: running ? 'scaleX(1)' : 'scaleX(0)' }}
        />
      </span>

      <div className="demo-story">
      <div className="flex items-center gap-2.5">
        <h2 className="demo-heading">Make the opening count.</h2>
        <button
          type="button"
          className="glass-control marking-playback ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[#c4b0ff] transition-colors hover:bg-white/10"
          aria-label={paused ? 'Play marking preview' : 'Pause marking preview'}
          onClick={() => { setRewritten(false); setPaused((value) => !value); }}
        >
          <GlassSurface />
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      </div>

      <div className="demo-comparison" aria-label="Compare the speech opening">
        <button type="button" className="glass-control demo-version" aria-pressed={!rewritten} onClick={() => setRewritten(false)}><GlassSurface />Original</button>
        <button type="button" className="glass-control demo-version" aria-pressed={rewritten} onClick={() => setRewritten(true)}><GlassSurface />Tightened opening</button>
      </div>
      <div className="demo-transcripts" aria-live="polite" aria-atomic="true">
      <p className="demo-transcript" data-active={!rewritten} aria-hidden={rewritten}>
        <span>
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
        })}</span>
      </p>
      <p className="demo-transcript" data-active={rewritten} aria-hidden={!rewritten}>
        {TIGHTENED.map((sentence, index) => <span key={sentence}>
          {index > 0 && <span className="demo-pause" aria-hidden="true"> / </span>}
          {sentence}{' '}
        </span>)}
      </p>
      </div>
      <div className="demo-explanations">
        <p className="demo-explanation" data-active={!rewritten} aria-hidden={rewritten}>Cut three fillers. Replace the vague claim with a fact your audience can picture.</p>
        <p className="demo-explanation" data-active={rewritten} aria-hidden={!rewritten}>Lead with a concrete fact. Pause between ideas so each one lands.</p>
      </div>
      <div className="demo-source-row">
        <span><span className="demo-pause" aria-hidden="true">/</span> Suggested pause</span>
        <span>Sources: <a href="https://www.unep.org/news-and-stories/story/why-we-need-fix-plastic-pollution-problem" target="_blank" rel="noopener noreferrer">UNEP</a>, <a href="https://www.who.int/publications/i/item/9789240054608" target="_blank" rel="noopener noreferrer">WHO</a></span>
      </div>
      <LandingAawax marking={running} />
      </div>

      <div className="demo-measures">
        <details className="demo-report-disclosure" open={!compact || reportExpanded}>
          <summary onClick={(event) => { event.preventDefault(); setReportExpanded((value) => !value); }}>
            Original delivery report <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="demo-report-content">
        <p className="demo-measures-caption">Original delivery · illustrative report</p>
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
          value="1 suggested pause"
        />
        <Measure
          show={settled >= 3}
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Speaking speed"
          value="152 words/min"
        />

        <div
          className="demo-score flex items-center gap-4 transition-[opacity,transform] duration-500"
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
        </details>
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
      className="demo-measure transition-[opacity,transform] duration-500"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[#c4b0ff]">
          {icon}
        </span>
        <span className="text-sm text-[#bcb2d4]">{label}</span>
      </div>
      <p className="text-sm text-[#f2efff]">{value}</p>
    </div>
  );
}
