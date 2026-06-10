'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { scoreColor, scoreGrade } from '@/lib/feedback';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Animated gradient score ring with a grade label. */
export function ScoreRing({ value, size = 150 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1300;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(ease * clamped));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const color = scoreColor(clamped);
  const grade = scoreGrade(clamped);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 210, damping: 18 }}
      className="flex flex-col items-center gap-2.5"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size}>
          <defs>
            <linearGradient id="score-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor="#f9a8d4" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
          <motion.circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="url(#score-ring-grad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - clamped / 100) }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
            transform="rotate(-90 60 60)"
            style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[2.4rem] leading-none tracking-tight text-white tabular-nums">{displayed}</span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-[#857ca2]">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-serif text-lg tracking-tight" style={{ color }}>{grade.label}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2]">{grade.tone}</p>
      </div>
    </motion.div>
  );
}
