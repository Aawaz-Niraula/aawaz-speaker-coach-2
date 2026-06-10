'use client';

import { useId, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Dices, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AVATAR_EYES,
  AVATAR_EYES_IDS,
  AVATAR_HAIRS,
  AVATAR_HAIR_IDS,
  AVATAR_KINDS,
  AVATAR_SKINS,
  AVATAR_SKIN_IDS,
  DEFAULT_AVATAR_STYLE,
  loadAvatarStyle,
  randomAvatarStyle,
  saveAvatarStyle,
  type AvatarEyesId,
  type AvatarHairId,
  type AvatarKindId,
  type AvatarSkinId,
  type AvatarStyle,
} from '@/lib/avatar';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

/* ── Avatar style store (same pattern as the Aawax store) ────────── */
const listeners = new Set<() => void>();
let cached: AvatarStyle | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AvatarStyle {
  if (!cached) cached = loadAvatarStyle();
  return cached;
}

function getServerSnapshot(): AvatarStyle {
  return DEFAULT_AVATAR_STYLE;
}

export function setAvatarStyle(next: AvatarStyle) {
  cached = next;
  saveAvatarStyle(next);
  listeners.forEach((listener) => listener());
}

export function useProfileAvatar() {
  const style = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { style, setStyle: setAvatarStyle };
}

/* ── The avatar itself ───────────────────────────────────────────── */
export function ProfileAvatar({
  size = 80,
  styleOverride,
  className,
}: {
  size?: number;
  /** Used by the customizer thumbnails to render a specific look. */
  styleOverride?: AvatarStyle;
  className?: string;
}) {
  const { style } = useProfileAvatar();
  const uid = useId();
  const look = styleOverride ?? style;

  const skin = AVATAR_SKINS[look.skin];
  const hair = AVATAR_HAIRS[look.hair];
  const eyes = AVATAR_EYES[look.eyes];

  const ids = { bg: `pav-bg-${uid}`, shirt: `pav-shirt-${uid}`, clip: `pav-clip-${uid}` };

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={ids.bg} cx="0.5" cy="0.35" r="0.85">
          <stop offset="0%" stopColor="#2b2342" />
          <stop offset="100%" stopColor="#171225" />
        </radialGradient>
        <linearGradient id={ids.shirt} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
        <clipPath id={ids.clip}>
          <circle cx="60" cy="60" r="58" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${ids.clip})`}>
        <circle cx="60" cy="60" r="58" fill={`url(#${ids.bg})`} />

        {/* female: long hair behind the head */}
        {look.kind === 'female' ? (
          <g fill={hair.base}>
            <ellipse cx="60" cy="46" rx="28" ry="32" />
            <rect x="32" y="44" width="13" height="52" rx="6.5" />
            <rect x="75" y="44" width="13" height="52" rx="6.5" />
          </g>
        ) : null}

        {/* shoulders */}
        <path d="M22 122 C22 96 38 86 60 86 C82 86 98 96 98 122 Z" fill={`url(#${ids.shirt})`} />

        {/* neck */}
        <rect x="53" y="68" width="14" height="18" rx="5" fill={skin.shade} />

        {/* ears */}
        <circle cx="37" cy="52" r="4.5" fill={skin.base} />
        <circle cx="83" cy="52" r="4.5" fill={skin.base} />

        {/* head */}
        <ellipse cx="60" cy="50" rx="23" ry="26" fill={skin.base} />

        {/* hair front */}
        {look.kind === 'female' ? (
          <path d="M37 50 C36 28 46 21 60 21 C74 21 84 28 83 50 C76 37 70 33 60 33 C50 33 44 37 37 50 Z" fill={hair.base} />
        ) : (
          <g fill={hair.base}>
            <path d="M37 52 C35 27 49 19 60 19 C71 19 85 27 83 52 C83 38 75 29 60 29 C45 29 37 38 37 52 Z" />
            <rect x="36" y="46" width="5" height="12" rx="2.5" />
            <rect x="79" y="46" width="5" height="12" rx="2.5" />
          </g>
        )}
        {/* hair shine */}
        <path
          d={look.kind === 'female' ? 'M46 26 C51 23 57 22 62 23 C56 24 50 26 46 30 Z' : 'M47 24 C52 21 58 20 63 21 C57 22 51 24 47 28 Z'}
          fill={hair.shine}
          opacity="0.7"
        />

        {/* eyebrows */}
        <g stroke={hair.base} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M47 44.5 Q51.5 42 56 44.5" />
          <path d="M64 44.5 Q68.5 42 73 44.5" />
        </g>

        {/* eyes */}
        <g>
          <ellipse cx="52" cy="52" rx="4.6" ry="3.8" fill="#ffffff" />
          <ellipse cx="68" cy="52" rx="4.6" ry="3.8" fill="#ffffff" />
          <circle cx="52" cy="52.4" r="2.7" fill={eyes.base} />
          <circle cx="68" cy="52.4" r="2.7" fill={eyes.base} />
          <circle cx="52" cy="52.4" r="1.2" fill="#1d1530" />
          <circle cx="68" cy="52.4" r="1.2" fill="#1d1530" />
          <circle cx="53" cy="51.4" r="0.8" fill="#ffffff" opacity="0.9" />
          <circle cx="69" cy="51.4" r="0.8" fill="#ffffff" opacity="0.9" />
        </g>

        {/* nose */}
        <path d="M60 56 Q62 60 60 63" stroke={skin.shade} strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* mouth */}
        <path d="M53 68 Q60 74 67 68" stroke="#8f4a44" strokeWidth="2.6" strokeLinecap="round" fill="none" />

        {/* blush */}
        <ellipse cx="45" cy="61" rx="4" ry="2.4" fill="#f9a8d4" opacity="0.4" />
        <ellipse cx="75" cy="61" rx="4" ry="2.4" fill="#f9a8d4" opacity="0.4" />
      </g>

      <circle cx="60" cy="60" r="57" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
    </svg>
  );
}

/* ── Swatch row helper ───────────────────────────────────────────── */
function SwatchRow<T extends string>({
  title,
  options,
  active,
  onPick,
}: {
  title: string;
  options: { id: T; label: string; color: string }[];
  active: T;
  onPick: (id: T) => void;
}) {
  return (
    <div>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#ddd6fe]">{title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        {options.map((option) => {
          const isActive = active === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              className={cn('relative flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110', isActive && 'scale-110')}
              aria-pressed={isActive}
              aria-label={`${option.label} ${title.toLowerCase()}`}
              title={option.label}
            >
              <span className="block h-9 w-9 rounded-full border-2 border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.4)]" style={{ background: option.color }} />
              {isActive ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#06060b]/80">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Customizer modal ────────────────────────────────────────────── */
export function AvatarCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { style, setStyle } = useProfileAvatar();

  const pick = (next: AvatarStyle) => {
    sfx.select();
    setStyle(next);
  };

  const shuffle = () => {
    sfx.shuffle();
    setStyle(randomAvatarStyle(style));
  };

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
            aria-label="Close avatar customizer"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Customise your avatar"
            initial={{ opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-[61] max-h-[88vh] w-[94vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d0c16]/96 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.8)] backdrop-blur-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2]">Your profile</p>
                <p className="mt-1 font-serif text-2xl tracking-tight text-white">Customise your avatar</p>
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

            {/* preview */}
            <div className="mt-4 flex flex-col items-center rounded-[22px] border border-white/10 bg-[radial-gradient(ellipse_at_50%_120%,rgba(167,139,250,0.16),transparent_70%)] py-6">
              <motion.div
                key={`${style.kind}-${style.skin}-${style.hair}-${style.eyes}`}
                initial={{ scale: 0.82, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 16 }}
              >
                <ProfileAvatar size={116} />
              </motion.div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.24em] text-[#857ca2]">This is how you appear in Account</p>
            </div>

            {/* style picker */}
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#ddd6fe]">Style</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {AVATAR_KINDS.map((kind) => {
                const isActive = style.kind === kind.id;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => pick({ ...style, kind: kind.id as AvatarKindId })}
                    className={cn(
                      'group flex items-center justify-center gap-2.5 rounded-[16px] border px-3 py-2.5 transition',
                      isActive
                        ? 'border-[#a78bfa]/50 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.10))]'
                        : 'border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8',
                    )}
                    aria-pressed={isActive}
                  >
                    <ProfileAvatar size={40} styleOverride={{ ...style, kind: kind.id as AvatarKindId }} className="transition-transform duration-200 group-hover:scale-110" />
                    <span className={cn('font-mono text-[10px] uppercase tracking-[0.14em]', isActive ? 'text-[#ddd6fe]' : 'text-[#857ca2]')}>{kind.label}</span>
                  </button>
                );
              })}
            </div>

            <SwatchRow
              title="Skin"
              options={AVATAR_SKIN_IDS.map((id) => ({ id, label: AVATAR_SKINS[id].label, color: AVATAR_SKINS[id].base }))}
              active={style.skin}
              onPick={(skin: AvatarSkinId) => pick({ ...style, skin })}
            />
            <SwatchRow
              title="Hair"
              options={AVATAR_HAIR_IDS.map((id) => ({ id, label: AVATAR_HAIRS[id].label, color: AVATAR_HAIRS[id].base }))}
              active={style.hair}
              onPick={(hair: AvatarHairId) => pick({ ...style, hair })}
            />
            <SwatchRow
              title="Eyes"
              options={AVATAR_EYES_IDS.map((id) => ({ id, label: AVATAR_EYES[id].label, color: AVATAR_EYES[id].base }))}
              active={style.eyes}
              onPick={(eyes: AvatarEyesId) => pick({ ...style, eyes })}
            />

            <div className="mt-6 flex items-center gap-2.5 border-t border-white/10 pt-4">
              <Button variant="secondary" onClick={shuffle} className="h-11 flex-1 rounded-[16px] font-mono text-[11px] uppercase tracking-[0.16em]">
                <Dices className="h-4 w-4" />
                Surprise me
              </Button>
            </div>
            <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f6691]">Saved automatically · only shown on your account page</p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
