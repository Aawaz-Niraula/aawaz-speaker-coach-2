'use client';

import { useRef, useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';

import { formatClock } from '@/lib/feedback';
import { cn } from '@/lib/utils';

/** Custom premium audio player with scrubbing and download. */
export function AudioPlayer({
  src,
  downloadName,
  className,
}: {
  src: string;
  downloadName?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset playback state when the source changes (render-time adjustment).
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-2 rounded-[16px] border border-white/10 bg-[#0b0b12]/60 px-2.5 py-2.5 sm:gap-3 sm:px-3', className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] text-[#06060b] shadow-[0_8px_24px_rgba(167,139,250,0.35)] transition hover:scale-105 active:scale-95 sm:h-10 sm:w-10"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#ddd6fe]">{formatClock(currentTime)}</span>
      <div className="relative flex h-8 min-w-0 flex-1 items-center">
        <div className="absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          className="audio-scrubber relative z-10 w-full cursor-pointer appearance-none bg-transparent"
          aria-label="Seek audio"
        />
      </div>
      <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-[#857ca2] min-[400px]:inline">{duration ? formatClock(duration) : '–:––'}</span>
      {downloadName ? (
        <a
          href={src}
          download={downloadName}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/12"
          aria-label="Download audio"
          title="Download audio"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}
