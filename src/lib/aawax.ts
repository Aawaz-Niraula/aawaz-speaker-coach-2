/**
 * Aawax — the coach mascot's customization system.
 * Designs and color palettes the user can pick from, persisted locally.
 */

export type AawaxDesignId = 'classic' | 'puff' | 'boxy' | 'kitty';
export type AawaxColorId = 'aurora' | 'ocean' | 'sunset' | 'meadow' | 'gold';

export type AawaxStyle = {
  design: AawaxDesignId;
  color: AawaxColorId;
  sound: boolean;
};

export type AawaxPalette = {
  label: string;
  from: string;
  to: string;
  footLeft: string;
  footRight: string;
  glow: string;
};

export const AAWAX_DESIGNS: { id: AawaxDesignId; label: string; blurb: string }[] = [
  { id: 'classic', label: 'Classic', blurb: 'The original stage presence' },
  { id: 'puff', label: 'Puff', blurb: 'Extra round, extra huggable' },
  { id: 'boxy', label: 'Boxy', blurb: 'Sharp suit energy' },
  { id: 'kitty', label: 'Kitty', blurb: 'Ears. Whiskers. Authority.' },
];

export const AAWAX_COLORS: Record<AawaxColorId, AawaxPalette> = {
  aurora: { label: 'Aurora', from: '#a78bfa', to: '#f9a8d4', footLeft: '#8b6fe0', footRight: '#e98cc0', glow: '#a78bfa' },
  ocean: { label: 'Ocean', from: '#60a5fa', to: '#5eead4', footLeft: '#3b82f6', footRight: '#2dd4bf', glow: '#60a5fa' },
  sunset: { label: 'Sunset', from: '#fb923c', to: '#f472b6', footLeft: '#f97316', footRight: '#ec4899', glow: '#fb923c' },
  meadow: { label: 'Meadow', from: '#4ade80', to: '#a3e635', footLeft: '#22c55e', footRight: '#84cc16', glow: '#4ade80' },
  gold: { label: 'Gold', from: '#facc15', to: '#fb923c', footLeft: '#eab308', footRight: '#f97316', glow: '#facc15' },
};

export const AAWAX_COLOR_IDS = Object.keys(AAWAX_COLORS) as AawaxColorId[];

export const DEFAULT_AAWAX_STYLE: AawaxStyle = {
  design: 'classic',
  color: 'aurora',
  sound: true,
};

const STORAGE_KEY = 'aawax-style-v1';

export function loadAawaxStyle(): AawaxStyle {
  if (typeof window === 'undefined') return DEFAULT_AAWAX_STYLE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AAWAX_STYLE;
    const parsed = JSON.parse(raw) as Partial<AawaxStyle>;
    return {
      design: AAWAX_DESIGNS.some((d) => d.id === parsed.design) ? (parsed.design as AawaxDesignId) : DEFAULT_AAWAX_STYLE.design,
      color: parsed.color && parsed.color in AAWAX_COLORS ? (parsed.color as AawaxColorId) : DEFAULT_AAWAX_STYLE.color,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_AAWAX_STYLE.sound,
    };
  } catch {
    return DEFAULT_AAWAX_STYLE;
  }
}

export function saveAawaxStyle(style: AawaxStyle) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // storage unavailable — style stays session-only
  }
}

export function randomAawaxStyle(current: AawaxStyle): AawaxStyle {
  const designs = AAWAX_DESIGNS.map((d) => d.id);
  const pick = <T,>(list: T[], not: T): T => {
    const options = list.filter((item) => item !== not);
    return options[Math.floor(Math.random() * options.length)] ?? not;
  };

  return {
    ...current,
    design: pick(designs, current.design),
    color: pick(AAWAX_COLOR_IDS, current.color),
  };
}
