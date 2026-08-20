'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

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
  | 'sing' // voice sample / audio
  | 'talk'; // mid-sentence, mouth moving (tour narration)

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
  snake: { x: 26, y: 30, w: 68, h: 72, rx: 34 },
  boxy: { x: 26, y: 34, w: 68, h: 64, rx: 18 },
  kitty: { x: 24, y: 34, w: 72, h: 66, rx: 32 },
};

/** Booped mascots show a special "pleased" face that isn't a public mood. */
type RenderMood = MascotMood | 'pleased';

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
  mouthOpen,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  float?: boolean;
  /** Tappable: boops, squeaks, and briefly cheers. */
  interactive?: boolean;
  /** Used by the customizer preview to render a specific look. */
  styleOverride?: Partial<Pick<AawaxStyle, 'design' | 'color' | 'accessory'>>;
  /**
   * 0–1 mouth openness, for lip-syncing to real audio. When provided (with
   * mood 'talk') the mouth follows this value instead of looping on its own.
   */
  mouthOpen?: number;
  className?: string;
}) {
  const { style } = useAawax();
  const uid = useId();
  const [booped, setBooped] = useState(false);
  /* Every idle loop below is gated on this. Each mascot runs several
     infinite SVG animations, and they are permanent compositor work even
     when nobody is looking at them. */
  const reduceMotion = useReducedMotion();
  const animated = !reduceMotion;

  const design = styleOverride?.design ?? style.design;
  const palette = AAWAX_COLORS[styleOverride?.color ?? style.color];
  const accessory = styleOverride?.accessory ?? style.accessory;
  const body = BODY_SHAPES[design];
  const effectiveMood: RenderMood = booped ? 'pleased' : mood;

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

      {/* antenna (kitty gets ears, snake gets a tail instead) */}
      {design !== 'kitty' && design !== 'snake' ? (
        <g>
          <path d="M60 32 C60 24 64 20 68 17" stroke="#ddd6fe" strokeWidth="3" strokeLinecap="round" fill="none" />
          <motion.circle
            cx="70"
            cy="15"
            r="5"
            fill={effectiveMood === 'cheer' ? '#fde68a' : palette.to}
            animate={effectiveMood === 'cheer' ? { scale: [1, 1.35, 1] } : { scale: [1, 1.12, 1] }}
            transition={{ duration: effectiveMood === 'cheer' ? 0.7 : 2.4, repeat: animated ? Infinity : 0, ease: 'easeInOut' }}
            style={{ transformOrigin: '70px 15px' }}
          />
        </g>
      ) : design === 'kitty' ? (
        <g>
          <path d="M33 44 L38 16 L54 34 Z" fill={`url(#${ids.body})`} />
          <path d="M87 44 L82 16 L66 34 Z" fill={`url(#${ids.body})`} />
          <path d="M38 38 L40 24 L49 33 Z" fill={palette.to} opacity="0.65" />
          <path d="M82 38 L80 24 L71 33 Z" fill={palette.to} opacity="0.65" />
        </g>
      ) : null}

      {/* arms */}
      <ellipse cx="22" cy="76" rx="8" ry="11" fill={`url(#${ids.body})`} transform={effectiveMood === 'cheer' ? 'rotate(-38 22 76)' : 'rotate(-12 22 76)'} />
      <ellipse cx="98" cy="76" rx="8" ry="11" fill={`url(#${ids.body})`} transform={effectiveMood === 'cheer' ? 'rotate(38 98 76)' : 'rotate(12 98 76)'} />

      {/* body */}
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx} fill={`url(#${ids.body})`} />
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx} fill={`url(#${ids.belly})`} />

      {/* feet (snakes get a curled tail instead) */}
      {design === 'snake' ? (
        <g>
          <path d="M82 96 C 98 102, 106 92, 99 84" fill="none" stroke={palette.footRight} strokeWidth="8" strokeLinecap="round" />
          <circle cx="99" cy="84" r="2.6" fill={palette.footRight} />
        </g>
      ) : (
        <g>
          <ellipse cx="46" cy="102" rx="10" ry="6" fill={palette.footLeft} />
          <ellipse cx="74" cy="102" rx="10" ry="6" fill={palette.footRight} />
        </g>
      )}

      {/* snake scales */}
      {design === 'snake' ? (
        <g fill="#ffffff" opacity="0.14">
          <path d="M46 88 l4 -4 4 4 -4 4 Z" />
          <path d="M58 93 l4 -4 4 4 -4 4 Z" />
          <path d="M70 88 l4 -4 4 4 -4 4 Z" />
        </g>
      ) : null}

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
      {effectiveMood === 'pleased' ? (
        <g stroke="#2a2140" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M40 59 Q46 65 52 59" />
          <path d="M68 59 Q74 65 80 59" />
        </g>
      ) : effectiveMood === 'cheer' ? (
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
      <ellipse cx="37" cy="71" rx="5.5" ry="3.4" fill={palette.to} opacity={effectiveMood === 'pleased' ? 0.95 : effectiveMood === 'oops' ? 0.35 : 0.65} />
      <ellipse cx="83" cy="71" rx="5.5" ry="3.4" fill={palette.to} opacity={effectiveMood === 'pleased' ? 0.95 : effectiveMood === 'oops' ? 0.35 : 0.65} />

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
      {effectiveMood === 'talk' && typeof mouthOpen === 'number' ? (
        /* Lip-sync: driven by the live amplitude of Aawax's narration, so the
           mouth actually tracks what he is saying. The mouth also widens a
           little as it opens, the way a real one does, and never fully shuts
           mid-word. */
        <ellipse
          cx="60"
          cy={78 + mouthOpen * 1.2}
          rx={4.6 + mouthOpen * 1.9}
          ry={Math.max(0.9, mouthOpen * 6.4)}
          fill="#2a2140"
        />
      ) : effectiveMood === 'talk' ? (
        // No audio to follow (muted, or autoplay blocked): fall back to an
        // uneven loop so he still reads as talking.
        <motion.ellipse
          cx="60"
          cy="78"
          rx="5.2"
          fill="#2a2140"
          animate={{ ry: [1.6, 6.2, 2.6, 5.4, 1.8, 4.8, 2.2] }}
          transition={{ duration: 1.15, repeat: animated ? Infinity : 0, ease: 'easeInOut' }}
        />
      ) : effectiveMood === 'cheer' ? (
        <path d="M51 74 Q60 84 69 74 Z" fill="#2a2140" />
      ) : effectiveMood === 'oops' ? (
        <path d="M52 80 Q60 73 68 80" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      ) : effectiveMood === 'think' ? (
        <path d="M53 78 Q57 75 61 78 Q65 81 67 78" stroke="#2a2140" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : effectiveMood === 'listen' || effectiveMood === 'sing' ? (
        <ellipse cx="60" cy="78" rx="5" ry="6" fill="#2a2140" />
      ) : effectiveMood === 'pleased' ? (
        <path d="M53 76 Q60 82 67 76" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M52 76 Q60 83 68 76" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      )}

      {/* dress-up accessories */}
      {accessory === 'crown' ? (
        <g stroke="#fff7c2" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M37 35 L34 16 L48 25 L60 8 L72 25 L86 16 L83 35 Z" fill="#facc15" />
          <path d="M38 31 H82" stroke="#fb923c" strokeWidth="4" />
          <circle cx="60" cy="20" r="3" fill="#f472b6" stroke="none" />
        </g>
      ) : accessory === 'glasses' ? (
        <g stroke="#171224" strokeWidth="3" strokeLinejoin="round">
          <rect x="31" y="53" width="25" height="17" rx="6" fill="#312e81" fillOpacity="0.82" />
          <rect x="64" y="53" width="25" height="17" rx="6" fill="#312e81" fillOpacity="0.82" />
          <path d="M56 59 Q60 56 64 59" fill="none" />
          <path d="M31 58 L24 55 M89 58 L96 55" fill="none" strokeLinecap="round" />
          <path d="M35 56 L44 65 M68 56 L77 65" stroke="#ffffff" strokeWidth="1.6" opacity="0.45" />
        </g>
      ) : accessory === 'party-hat' ? (
        <g strokeLinejoin="round">
          <path d="M39 39 L62 6 L78 40 Z" fill="#22d3ee" stroke="#ddd6fe" strokeWidth="1.5" />
          <path d="M45 31 L72 23" stroke="#f472b6" strokeWidth="5" />
          <circle cx="62" cy="6" r="5" fill="#fde047" />
          <circle cx="55" cy="24" r="2.5" fill="#ffffff" />
          <path d="M38 39 Q59 34 79 40" stroke="#a78bfa" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ) : accessory === 'flower' ? (
        <g>
          {[0, 60, 120, 180, 240, 300].map((rotation) => (
            <ellipse
              key={rotation}
              cx="91"
              cy="27"
              rx="4.5"
              ry="9"
              fill="#f9a8d4"
              transform={`rotate(${rotation} 91 38)`}
            />
          ))}
          <circle cx="91" cy="38" r="6" fill="#fde047" stroke="#fff7c2" strokeWidth="1.5" />
        </g>
      ) : null}

      {/* snake tongue flick */}
      {design === 'snake' && effectiveMood !== 'listen' && effectiveMood !== 'sing' ? (
        <motion.g
          stroke="#fb7185"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          animate={{ scaleY: [0.2, 1, 1, 0.2], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.2, repeat: animated ? Infinity : 0, times: [0, 0.12, 0.4, 0.52], ease: 'easeInOut' }}
          style={{ transformOrigin: '60px 83px' }}
        >
          <path d="M60 84 L60 91" />
          <path d="M60 91 L56.5 95" />
          <path d="M60 91 L63.5 95" />
        </motion.g>
      ) : null}

      {/* boop heart */}
      {booped ? (
        <motion.path
          d="M90 32 c2.5 -4 8 -3 8 1.2 c0 3 -4 5.6 -8 8 c-4 -2.4 -8 -5 -8 -8 c0 -4.2 5.5 -5.2 8 -1.2 Z"
          fill="#f9a8d4"
          initial={{ opacity: 0, y: 4, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -12, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      ) : null}

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
              transition={{ duration: 1.4, repeat: animated ? Infinity : 0, delay: i * 0.25 }}
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
              transition={{ duration: 1.5, repeat: animated ? Infinity : 0, delay: i * 0.4 }}
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
              transition={{ duration: 2, repeat: animated ? Infinity : 0, delay: i * 0.9 }}
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
        animate={booped ? { rotate: [0, -4, 4, -2, 0], y: [0, -4, 0, -2, 0], scale: [1, 1.05, 1] } : float && animated ? { y: [0, -4, 0] } : { y: 0 }}
        transition={booped
          ? { duration: 0.6, ease: 'easeOut' }
          : float
            ? { duration: 3.4, repeat: animated ? Infinity : 0, ease: 'easeInOut' }
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
      animate={float && animated ? { y: [0, -4, 0] } : undefined}
      transition={float && animated ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
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
