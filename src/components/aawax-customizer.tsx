'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Dices, Volume2, VolumeX, X } from 'lucide-react';

import { CoachMascot, useAawax } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import {
  AAWAX_COLOR_IDS,
  AAWAX_COLORS,
  AAWAX_DESIGNS,
  randomAawaxStyle,
  type AawaxColorId,
  type AawaxDesignId,
} from '@/lib/aawax';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

/**
 * "Customise Aawax" — a polished, game-like dress-up panel for the mascot.
 * Changes apply instantly across the whole app and persist locally.
 */
export function AawaxCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { style, setStyle } = useAawax();
  const [spinKey, setSpinKey] = useState(0);

  const pickDesign = (design: AawaxDesignId) => {
    if (design === style.design) return;
    sfx.select();
    setSpinKey((k) => k + 1);
    setStyle({ ...style, design });
  };

  const pickColor = (color: AawaxColorId) => {
    if (color === style.color) return;
    sfx.select();
    setSpinKey((k) => k + 1);
    setStyle({ ...style, color });
  };

  const shuffle = () => {
    sfx.shuffle();
    setSpinKey((k) => k + 1);
    setStyle(randomAawaxStyle(style));
  };

  const toggleSound = () => {
    const next = { ...style, sound: !style.sound };
    setStyle(next);
    if (next.sound) sfx.pop();
  };

  const selectedDesign = AAWAX_DESIGNS.find((d) => d.id === style.design);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close Aawax customizer"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Customise Aawax"
            initial={{ opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-[61] max-h-[88vh] w-[94vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d0c16]/96 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.8)] backdrop-blur-xl sm:p-6"
          >
            {/* header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2]">Dress-up room</p>
                <p className="mt-1 font-serif text-2xl tracking-tight text-white">
                  Customise <span className="bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] bg-clip-text text-transparent">Aawax</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#857ca2] transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* stage / preview */}
            <div className="relative mt-4 flex flex-col items-center overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(ellipse_at_50%_120%,rgba(167,139,250,0.18),transparent_70%)] py-6">
              {/* sparkle backdrop */}
              {[...Array(6)].map((_, i) => (
                <motion.span
                  key={i}
                  className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#ddd6fe]"
                  style={{ left: `${12 + i * 15}%`, top: `${18 + (i % 3) * 24}%` }}
                  animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.7, 1.3, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.35 }}
                />
              ))}
              <motion.div
                key={spinKey}
                initial={{ scale: 0.7, rotate: -8, opacity: 0.4 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              >
                <CoachMascot mood="cheer" size={120} interactive float={false} />
              </motion.div>
              {/* pedestal */}
              <div className="mt-1 h-2.5 w-24 rounded-[50%] bg-black/45 blur-[2px]" />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#857ca2]">
                {selectedDesign?.blurb ?? 'Looking sharp'} · tap to boop
              </p>
            </div>

            {/* design picker */}
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#ddd6fe]">Design</p>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {AAWAX_DESIGNS.map((design) => {
                const active = style.design === design.id;
                return (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => pickDesign(design.id)}
                    className={cn(
                      'group flex flex-col items-center gap-1.5 rounded-[16px] border px-1.5 pb-2 pt-2.5 transition',
                      active
                        ? 'border-[#a78bfa]/50 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.10))]'
                        : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8',
                    )}
                    aria-pressed={active}
                  >
                    <CoachMascot
                      mood="idle"
                      size={44}
                      float={false}
                      styleOverride={{ design: design.id, color: style.color }}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
                    <span className={cn('font-mono text-[9px] uppercase tracking-[0.12em]', active ? 'text-[#ddd6fe]' : 'text-[#857ca2]')}>
                      {design.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* color picker */}
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#ddd6fe]">Color</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {AAWAX_COLOR_IDS.map((colorId) => {
                const palette = AAWAX_COLORS[colorId];
                const active = style.color === colorId;
                return (
                  <button
                    key={colorId}
                    type="button"
                    onClick={() => pickColor(colorId)}
                    className={cn(
                      'relative flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110',
                      active && 'scale-110',
                    )}
                    aria-pressed={active}
                    aria-label={`${palette.label} color`}
                    title={palette.label}
                  >
                    <span
                      className="block h-9 w-9 rounded-full border-2 border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
                      style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
                    />
                    <AnimatePresence>
                      {active ? (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#06060b]/80">
                            <Check className="h-3 w-3 text-white" />
                          </span>
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>

            {/* footer actions */}
            <div className="mt-6 flex items-center gap-2.5 border-t border-white/10 pt-4">
              <Button variant="secondary" onClick={shuffle} className="h-11 flex-1 rounded-[16px] font-mono text-[11px] uppercase tracking-[0.16em]">
                <Dices className="h-4 w-4" />
                Surprise me
              </Button>
              <Button
                variant="secondary"
                onClick={toggleSound}
                className={cn('h-11 rounded-[16px] px-4 font-mono text-[11px] uppercase tracking-[0.12em]', !style.sound && 'opacity-70')}
                aria-pressed={style.sound}
                title={style.sound ? 'Mute sound effects' : 'Enable sound effects'}
              >
                {style.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {style.sound ? 'Sound on' : 'Muted'}
              </Button>
            </div>
            <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f6691]">Saved automatically · Aawax remembers</p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
