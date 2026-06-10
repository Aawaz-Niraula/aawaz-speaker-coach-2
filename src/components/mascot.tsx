'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export type MascotMood =
  | 'idle' // gentle smile, ready
  | 'listen' // headphones on, recording
  | 'think' // analyzing / generating
  | 'cheer' // success / high score
  | 'coach' // neutral coaching, mid score
  | 'oops' // error / low score
  | 'sing'; // voice sample / audio

/**
 * "Awa" — the Aawaz coach mascot. A small gacha-style blob that guides the
 * user through recording, feedback, and voice setup. Pure inline SVG.
 */
export function CoachMascot({
  mood = 'idle',
  size = 72,
  float = true,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn('pointer-events-none select-none', className)}
      style={{ width: size, height: size }}
      animate={float ? { y: [0, -4, 0] } : undefined}
      transition={float ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <defs>
          <linearGradient id="awa-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
          <linearGradient id="awa-belly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="awa-glow" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* soft glow */}
        <circle cx="60" cy="66" r="52" fill="url(#awa-glow)" />

        {/* antenna */}
        <g>
          <path d="M60 32 C60 24 64 20 68 17" stroke="#ddd6fe" strokeWidth="3" strokeLinecap="round" fill="none" />
          <motion.circle
            cx="70"
            cy="15"
            r="5"
            fill={mood === 'cheer' ? '#fde68a' : '#f9a8d4'}
            animate={mood === 'cheer' ? { scale: [1, 1.35, 1] } : { scale: [1, 1.12, 1] }}
            transition={{ duration: mood === 'cheer' ? 0.7 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '70px 15px' }}
          />
        </g>

        {/* arms */}
        <ellipse cx="22" cy="76" rx="8" ry="11" fill="url(#awa-body)" transform={mood === 'cheer' ? 'rotate(-38 22 76)' : 'rotate(-12 22 76)'} />
        <ellipse cx="98" cy="76" rx="8" ry="11" fill="url(#awa-body)" transform={mood === 'cheer' ? 'rotate(38 98 76)' : 'rotate(12 98 76)'} />

        {/* body */}
        <rect x="24" y="32" width="72" height="68" rx="33" fill="url(#awa-body)" />
        <rect x="24" y="32" width="72" height="68" rx="33" fill="url(#awa-belly)" />

        {/* feet */}
        <ellipse cx="46" cy="102" rx="10" ry="6" fill="#8b6fe0" />
        <ellipse cx="74" cy="102" rx="10" ry="6" fill="#e98cc0" />

        {/* headphones for listening */}
        {mood === 'listen' ? (
          <g>
            <path d="M28 60 C28 38 92 38 92 60" stroke="#1d1530" strokeWidth="5" fill="none" strokeLinecap="round" />
            <rect x="20" y="56" width="11" height="20" rx="5.5" fill="#1d1530" />
            <rect x="89" y="56" width="11" height="20" rx="5.5" fill="#1d1530" />
            <rect x="22" y="58" width="7" height="16" rx="3.5" fill="#a78bfa" opacity="0.7" />
            <rect x="91" y="58" width="7" height="16" rx="3.5" fill="#f9a8d4" opacity="0.7" />
          </g>
        ) : null}

        {/* mic for sing mood */}
        {mood === 'sing' ? (
          <g transform="rotate(18 96 84)">
            <rect x="93" y="74" width="7" height="20" rx="3.5" fill="#2a2140" />
            <circle cx="96.5" cy="71" r="7.5" fill="#1d1530" />
            <circle cx="94.5" cy="69" r="2.4" fill="#ddd6fe" opacity="0.8" />
          </g>
        ) : null}

        {/* eyes */}
        {mood === 'cheer' ? (
          <g stroke="#2a2140" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M40 62 Q46 54 52 62" />
            <path d="M68 62 Q74 54 80 62" />
          </g>
        ) : mood === 'oops' ? (
          <g stroke="#2a2140" strokeWidth="3.6" strokeLinecap="round">
            <path d="M42 58 L51 64" />
            <path d="M51 58 L42 64" />
            <path d="M69 58 L78 64" />
            <path d="M78 58 L69 64" />
          </g>
        ) : mood === 'think' ? (
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
        <ellipse cx="37" cy="71" rx="5.5" ry="3.4" fill="#f9a8d4" opacity={mood === 'oops' ? 0.35 : 0.65} />
        <ellipse cx="83" cy="71" rx="5.5" ry="3.4" fill="#f9a8d4" opacity={mood === 'oops' ? 0.35 : 0.65} />

        {/* mouth */}
        {mood === 'cheer' ? (
          <path d="M51 74 Q60 84 69 74 Z" fill="#2a2140" />
        ) : mood === 'oops' ? (
          <path d="M52 80 Q60 73 68 80" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        ) : mood === 'think' ? (
          <path d="M53 78 Q57 75 61 78 Q65 81 67 78" stroke="#2a2140" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : mood === 'listen' || mood === 'sing' ? (
          <ellipse cx="60" cy="78" rx="5" ry="6" fill="#2a2140" />
        ) : (
          <path d="M52 76 Q60 83 68 76" stroke="#2a2140" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        )}

        {/* thinking dots */}
        {mood === 'think' ? (
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
        {mood === 'cheer' ? (
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
        {mood === 'sing' ? (
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
