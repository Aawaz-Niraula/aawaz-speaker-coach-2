'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#a78bfa', '#f9a8d4', '#fde68a', '#ddd6fe', '#86efac'];

type Particle = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
  shape: 'rect' | 'circle';
};

/** Deterministic PRNG (mulberry32) so particle layout is stable across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One-shot confetti burst, rendered absolutely inside a relative parent.
 * Pure framer-motion — no canvas, no deps.
 */
export function ConfettiBurst({ count = 26 }: { count?: number }) {
  const particles = useMemo<Particle[]>(() => {
    const rand = mulberry32(count * 7919 + 42);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
      const distance = 70 + rand() * 110;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.7 + 40 + rand() * 60,
        rotate: rand() * 540 - 270,
        scale: 0.6 + rand() * 0.8,
        color: COLORS[i % COLORS.length],
        delay: rand() * 0.18,
        duration: 1.5 + rand() * 0.5,
        shape: i % 3 === 0 ? 'circle' : 'rect',
      };
    });
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/3"
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: p.scale }}
          animate={{ x: p.x, y: p.y, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.16, 0.66, 0.45, 0.94] }}
          style={{
            width: p.shape === 'circle' ? 7 : 9,
            height: p.shape === 'circle' ? 7 : 5,
            borderRadius: p.shape === 'circle' ? 999 : 2,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}
