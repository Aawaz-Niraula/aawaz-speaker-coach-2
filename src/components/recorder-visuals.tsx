'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

/**
 * Live microphone waveform driven by a real AnalyserNode, drawn on canvas.
 * Falls back gracefully if AudioContext is unavailable.
 */
export function LiveWaveform({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return;

    type AudioContextCtor = typeof AudioContext;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext || (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const audioContext = new Ctor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const draw = () => {
      const { clientWidth, clientHeight } = canvas;
      if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
      }

      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 42;
      const gap = 3 * dpr;
      const barWidth = (canvas.width - gap * (bars - 1)) / bars;
      const usable = Math.floor(data.length * 0.72); // skip the silent top end

      for (let i = 0; i < bars; i += 1) {
        const dataIndex = Math.floor((i / bars) * usable);
        const value = data[dataIndex] / 255;
        const height = Math.max(3 * dpr, value * canvas.height * 0.92);
        const x = i * (barWidth + gap);
        const y = (canvas.height - height) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#a78bfa');
        gradient.addColorStop(1, '#f9a8d4');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.45 + value * 0.55;

        const radius = Math.min(barWidth / 2, 3 * dpr);
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, radius);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close().catch(() => null);
    };
  }, [stream]);

  return <canvas ref={canvasRef} className={cn('h-full w-full', className)} aria-hidden />;
}

/** Shimmering placeholder lines for content that is being generated. */
export function SkeletonLines({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2.5', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-3.5 rounded-full"
          style={{ width: `${[92, 100, 84, 96, 70][i % 5]}%` }}
        />
      ))}
    </div>
  );
}

/** Three bouncing dots, the app's compact busy indicator. */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-2', className)} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }}
          className="h-2 w-2 rounded-full bg-[#a78bfa]"
        />
      ))}
    </div>
  );
}
