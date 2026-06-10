'use client';

import { motion } from 'framer-motion';

import { CoachMascot } from '@/components/mascot';

type HistoryPoint = {
  overall_score: number | null;
  template_label: string | null;
};

export function ProgressChart({ history }: { history: HistoryPoint[] }) {
  const scored = history
    .filter((h) => h.overall_score !== null)
    .slice()
    .reverse();

  if (scored.length < 1) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/4">
        <CoachMascot mood="idle" size={64} />
        <p className="font-mono text-xs text-[#857ca2]">Record one speech and your trend line begins here.</p>
      </div>
    );
  }

  const scores = scored.map((h) => h.overall_score as number);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const best = Math.max(...scores);
  const latest = scores[scores.length - 1];
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const delta = scores.length > 1 ? latest - scores[scores.length - 2] : 0;

  const W = 600;
  const H = 200;
  const padX = 42;
  const padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const points = scores.map((s, i) => {
    const x = padX + (scores.length === 1 ? chartW / 2 : (i / (scores.length - 1)) * chartW);
    const y = padY + chartH - ((s - minScore) / range) * chartH;
    return { x, y, score: s, label: scored[i].template_label || 'General' };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round(minScore + (range / gridLines) * i),
  );

  const stats = [
    { label: 'Latest', value: String(latest) },
    { label: 'Best', value: String(best) },
    { label: 'Average', value: String(average) },
    {
      label: 'Last change',
      value: delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`,
      color: delta > 0 ? '#86efac' : delta < 0 ? '#f87171' : undefined,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-[16px] border border-white/10 bg-[#0b0b12]/50 px-3.5 py-3"
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#857ca2]">{stat.label}</div>
            <div className="mt-1 font-serif text-2xl tracking-tight tabular-nums" style={{ color: stat.color || '#f2efff' }}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        {gridValues.map((v) => {
          const gy = padY + chartH - ((v - minScore) / range) * chartH;
          return (
            <g key={v}>
              <line x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={padX - 6} y={gy + 4} textAnchor="end" fill="#857ca2" fontSize="10" fontFamily="monospace">{v}</text>
            </g>
          );
        })}
        <motion.path
          d={areaPath}
          fill="url(#areaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + (i / points.length) * 0.85 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            >
              {isLast ? (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r="9"
                  fill="none"
                  stroke="#f9a8d4"
                  strokeWidth="1.5"
                  animate={{ opacity: [0.7, 0, 0.7], scale: [0.7, 1.5, 0.7] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
              ) : null}
              <circle cx={p.x} cy={p.y} r="5" fill="#0b0b12" stroke={isLast ? '#f9a8d4' : '#a78bfa'} strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="2.5" fill={isLast ? '#f9a8d4' : '#a78bfa'} />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#ddd6fe" fontSize="10" fontFamily="monospace">{p.score}</text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
