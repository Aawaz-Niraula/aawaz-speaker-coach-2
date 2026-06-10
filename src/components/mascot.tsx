'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';

import {
  AAWAX_COLORS,
  DEFAULT_AAWAX_STYLE,
  loadAawaxStyle,
  saveAawaxStyle,
  type AawaxStyle,
} from '@/lib/aawax';
import { setSoundEnabled, sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

export type MascotMood =
  | 'idle' // gentle smile, ready
  | 'listen' // headphones on, recording
  | 'think' // analyzing / generating
  | 'cheer' // success / high score
  | 'coach' // neutral coaching, mid score
  | 'oops' // error / low score
  | 'sing'; // voice sample / audio

/* ── Aawax style store ───────────────────────────────────────────────
 * A tiny external store (instead of context) so every mascot in the app
 * updates instantly when the user restyles Aawax. useSyncExternalStore
 * keeps SSR hydration clean: the server snapshot is the default look,
 * and the saved look is applied right after hydration. */
const styleListeners = new Set<() => void>();
let cachedStyle: AawaxStyle | null = null;

function subscribeToStyle(listener: () => void) {
  styleListeners.add(listener);
  return () => {
    styleListeners.delete(listener);
  };
}

function getStyleSnapshot(): AawaxStyle {
  if (!cachedStyle) {
    cachedStyle = loadAawaxStyle();
    setSoundEnabled(cachedStyle.sound);
  }
  return cachedStyle;
}

function getServerStyleSnapshot(): AawaxStyle {
  return DEFAULT_AAWAX_STYLE;
}

export function setAawaxStyle(next: AawaxStyle) {
  cachedStyle = next;
  saveAawaxStyle(next);
  setSoundEnabled(next.sound);
  styleListeners.forEach((listener) => listener());
}

export function useAawax() {
  const style = useSyncExternalStore(subscribeToStyle, getStyleSnapshot, getServerStyleSnapshot);
  return { style, setStyle: setAawaxStyle };
}

/* ── Body shapes per design ──────────────────────────────────────── */
const BODY_SHAPES: Record<AawaxStyle['design'], { x: number; y: number; w: number; h: number; rx: number }> = {
  classic: { x: 24, y: 32, w: 72, h: 68, rx: 33 },
  puff: { x: 22, y: 31, w: 76, h: 70, rx: 38 },
  boxy: { x: 26, y: 34, w: 68, h: 64, rx: 18 },
  kitty: { x: 24, y: 34, w: 72, h: 66, rx: 32 },
};

/**
 * "Aawax" — the Aawaz coach mascot. A small gacha-style blob that guides the
 * user through recording, feedback, and voice setup. Pure inline SVG, fully
 * customizable (design + palette) via the Aawax context.
 */
export function CoachMascot({
  mood = 'idle',
  size = 72,
  float = true,
  interactive = false,
  styleOverride,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  float?: boolean;
  /** Tappable: boops, squeaks, and briefly cheers. */
  interactive?: boolean;
  /** Used by the customizer preview to render a specific look. */
  styleOverride?: Pick<AawaxStyle, 'design' | 'color'>;
  className?: string;
}) {
  const { style } = useAawax();
  const uid = useId();
  const [booped, setBooped] = useState(false);

  const design = styleOverride?.design ?? style.design;
  const palette = AAWAX_COLORS[styleOverride?.color ?? style.color];
  const body = BODY_SHAPES[design];
  const effectiveMood: MascotMood = booped ? 'cheer' : mood;

  useEffect(() => {
    if (!booped) return;
    const timeout = setTimeout(() => setBooped(false), 1100);
    return () => clearTimeout(timeout);
  }, [booped]);

  const boop = () => {
    if (!interactive) return;
    sfx.tap();
    setBooped(true);
  };

  const ids = {
    body: `awa-body-${uid}`,
    belly: `awa-belly-${uid}`,
    glow: `awa-glow-${uid}`,
  };

  const svg = (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
        <linearGradient id={ids.belly} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.glow} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0%" stopColor={palette.glow} stopOpacity="0.45" />
          <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft glow */}
      <circle cx="60" cy="66" r="52" fill={`url(#${ids.glow})`} />

      {/* antenna (kitty gets ears instead) */}
      {design !== 'kitty' ? (
        <g>
          <path d="M60 32 C60 24 64 20 68 17" stroke="#ddd6fe" strokeWidth="3" strokeLinecap="round" fill="none" />
          <motion.circle
            cx="70"
            cy="15"
            r="5"
            fill={effectiveMood === 'cheer' ? '#fde68a' : palette.to}
            animate={effectiveMood === 'cheer' ? { scale: [1, 1.35, 1] } : { scale: [1, 1.12, 1] }}
            transition={{ duration: effectiveMood === 'cheer' ? 0.7 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '70px 15px' }}
          />
        </g>
      ) : (
        <g>
          <path d="M33 44 L38 16 L54 34 Z" fill={`url(#${ids.body})`} />
          <path d="M87 44 L82 16 L66 34 Z" fill={`url(#${ids.body})`} />
          <path d="M38 38 L40 24 L49 33 Z" fill={palette.to} opacity="0.65" />
          <path d="M82 38 L80 24 L71 33 Z" fill={palette.to} opacity="0.65" />
        </g>
      )}

      {/* arms */}
      <ellipse cx="22" cy="76" rx="8" ry="11" fill={`url(#${ids.body})`} transform={effectiveMood === 'cheer' ? 'rotate(-38 22 76)' : 'rotate(-12 22 76)'} />
      <ellipse cx="98" cy="76" rx="8" ry="11" fill={`url(#${ids.body})`} transform={effectiveMood === 'cheer' ? 'rotate(38 98 76)' : 'rotate(12 98 76)'} />

      {/* body */}
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx} fill={`url(#${ids.body})`} />
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx} fill={`url(#${ids.belly})`} />

      {/* feet */}
      <ellipse cx="46" cy="102" rx="10" ry="6" fill={palette.footLeft} />
      <ellipse cx="74" cy="102" rx="10" ry="6" fill={palette.footRight} />

      {/* headphones for listening */}
      {effectiveMood === 'listen' ? (
        <g>
          <path d="M28 60 C28 38 92 38 92 60" stroke="#1d1530" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="20" y="56" width="11" height="20" rx="5.5" fill="#1d1530" />
          <rect x="89" y="56" width="11" height="20" rx="5.5" fill="#1d1530" />
          <rect x="22" y="58" width="7" height="16" rx="3.5" fill={palette.from} opacity="0.7" />
          <rect x="91" y="58" width="7" height="16" rx="3.5" fill={palette.to} opacity="0.7" />
        </g>
      ) : null}

      {/* mic for sing mood */}
      {effectiveMood === 'sing' ? (
        <g transform="rotate(18 96 84)">
          <rect x="93" y="74" width="7" height="20" rx="3.5" fill="#2a2140" />
          <circle cx="96.5" cy="71" r="7.5" fill="#1d1530" />
          <circle cx="94.5" cy="69" r="2.4" fill="#ddd6fe" opacity="0.8" />
        </g>
      ) : null}

      {/* eyes */}
      {effectiveMood === 'cheer' ? (
        <g stroke="#2a2140" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M40 62 Q46 54 52 62" />
          <path d="M68 62 Q74 54 80 62" />
        </g>
      ) : effectiveMood === 'oops' ? (
        <g stroke="#2a2140" strokeWidth="3.6" strokeLinecap="round">
          <path d="M42 58 L51 64" />
          <path d="M51 58 L42 64" />
          <path d="M69 58 L78 64" />
          <path d="M78 58 L69 64" />
        </g>
      ) : effectiveMood === 'think' ? (
        <g fill="#2a2140">
          <ellipse cx="46" cy="59" rx="4.4" ry="3.2" />
          <ellipse cx="74" cy="59" rx="4.4" ry="3.2" />
        </g>
      ) : (
        <g fill="#2a2140" className="awa-blink">
          <circle cx="46" cy="61" r="4.6" />
          <circle cx="74" cy="61" r="4.6" />
          <circle cx="47.6" cy="59.4" r="1.5" fill="#ffffff" opacity="0.9" />
          <circle cx="75.6" cy="59.4" r="1.5" fill="#ffffff" opacity="0.9" />
        </g>
      )}

      {/* cheeks */}
      <ellipse cx="37" cy="71" rx="5.5" ry="3.4" fill={palette.to} opacity={effectiveMood === 'oops' ? 0.35 : 0.65} />
      <ellipse cx="83" cy="71" rx="5.5" ry="3.4" fill={palette.to} opacity={effectiveMood === 'oops' ? 0.35 : 0.65} />

      {/* kitty whiskers */}
      {design === 'kitty' ? (
        <g stroke="#2a2140" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
          <path d="M30 68 L20 66" />
          <path d="M30 73 L20 74" />
          <path d="M90 68 L100 66" />
          <path d="M90 73 L100 74" />
        </g>
      ) : null}

      {/* mouth */}
      {effectiveMood === 'cheer' ? (
        <path d="M51 74 Q60 84 69 74 Z" fill="#2a2140" />
      ) : effectiveMood === 'oops' ? (
        <path d="M52 80 Q60 73 68 80" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      ) : effectiveMood === 'think' ? (
        <path d="M53 78 Q57 75 61 78 Q65 81 67 78" stroke="#2a2140" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : effectiveMood === 'listen' || effectiveMood === 'sing' ? (
        <ellipse cx="60" cy="78" rx="5" ry="6" fill="#2a2140" />
      ) : (
        <path d="M52 76 Q60 83 68 76" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      )}

      {/* thinking dots */}
      {effectiveMood === 'think' ? (
        <g fill="#ddd6fe">
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={96 + i * 8}
              cy={34 - i * 7}
              r={2.4 + i * 0.9}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
            />
          ))}
        </g>
      ) : null}

      {/* cheer sparkles */}
      {effectiveMood === 'cheer' ? (
        <g fill="#fde68a">
          {[{ x: 18, y: 36, s: 1 }, { x: 102, y: 30, s: 0.8 }].map((p, i) => (
            <motion.path
              key={i}
              d={`M${p.x} ${p.y - 6 * p.s} L${p.x + 1.8 * p.s} ${p.y - 1.8 * p.s} L${p.x + 6 * p.s} ${p.y} L${p.x + 1.8 * p.s} ${p.y + 1.8 * p.s} L${p.x} ${p.y + 6 * p.s} L${p.x - 1.8 * p.s} ${p.y + 1.8 * p.s} L${p.x - 6 * p.s} ${p.y} L${p.x - 1.8 * p.s} ${p.y - 1.8 * p.s} Z`}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.12, 0.85] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            />
          ))}
        </g>
      ) : null}

      {/* music notes for sing */}
      {effectiveMood === 'sing' ? (
        <g fill="#ddd6fe">
          {[0, 1].map((i) => (
            <motion.g
              key={i}
              animate={{ y: [-2, -10], opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.9 }}
            >
              <circle cx={16 + i * 8} cy={44 - i * 12} r="2.6" />
              <rect x={18 + i * 8} y={32 - i * 12} width="1.8" height="12" rx="0.9" />
            </motion.g>
          ))}
        </g>
      ) : null}
    </svg>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={boop}
        className={cn('cursor-pointer select-none border-none bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60 rounded-full', className)}
        style={{ width: size, height: size }}
        animate={booped ? { scale: [1, 1.18, 0.94, 1.06, 1], rotate: [0, -6, 5, -2, 0] } : float ? { y: [0, -4, 0] } : { y: 0 }}
        transition={booped
          ? { duration: 0.55, ease: 'easeOut' }
          : float
            ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
            : undefined}
        whileTap={{ scale: 0.92 }}
        aria-label="Boop Aawax"
        title="Boop Aawax"
      >
        {svg}
      </motion.button>
    );
  }

  return (
    <motion.div
      className={cn('pointer-events-none select-none', className)}
      style={{ width: size, height: size }}
      animate={float ? { y: [0, -4, 0] } : undefined}
      transition={float ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      aria-hidden
    >
      {svg}
    </motion.div>
  );
}

/** Mascot + speech bubble, used for guidance and empty states. */
export function MascotHint({
  mood = 'idle',
  title,
  children,
  size = 64,
  className,
}: {
  mood?: MascotMood;
  title?: string;
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 sm:gap-4', className)}>
      <CoachMascot mood={mood} size={size} className="shrink-0" />
      <div className="relative min-w-0 rounded-2xl rounded-bl-md border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
        {title ? <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#ddd6fe]">{title}</p> : null}
        <div className="text-sm leading-6 text-[#cfc8e8]">{children}</div>
      </div>
    </div>
  );
}
