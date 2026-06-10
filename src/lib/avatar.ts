/**
 * Profile avatar customization — a human avatar shown only on the Account tab.
 * The user picks a style (male/female), skin tone, hair color, and eye color.
 * Persisted locally, just like the Aawax mascot style.
 */

export type AvatarKindId = 'male' | 'female';
export type AvatarSkinId = 'light' | 'brown' | 'dark';
export type AvatarHairId = 'black' | 'blonde' | 'red';
export type AvatarEyesId = 'brown' | 'blue' | 'green';

export type AvatarStyle = {
  kind: AvatarKindId;
  skin: AvatarSkinId;
  hair: AvatarHairId;
  eyes: AvatarEyesId;
};

export const AVATAR_KINDS: { id: AvatarKindId; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];

export const AVATAR_SKINS: Record<AvatarSkinId, { label: string; base: string; shade: string }> = {
  light: { label: 'Light', base: '#f3c9a5', shade: '#e0b189' },
  brown: { label: 'Brown', base: '#c98e5a', shade: '#b27947' },
  dark: { label: 'Dark', base: '#8d5a3b', shade: '#774a30' },
};

export const AVATAR_HAIRS: Record<AvatarHairId, { label: string; base: string; shine: string }> = {
  black: { label: 'Black', base: '#2b2333', shine: '#4a4060' },
  blonde: { label: 'Blonde', base: '#e3bd62', shine: '#f3d98e' },
  red: { label: 'Red', base: '#bb5230', shine: '#d97a52' },
};

export const AVATAR_EYES: Record<AvatarEyesId, { label: string; base: string }> = {
  brown: { label: 'Brown', base: '#6b4a2f' },
  blue: { label: 'Blue', base: '#4f8fd6' },
  green: { label: 'Green', base: '#4f9e68' },
};

export const AVATAR_SKIN_IDS = Object.keys(AVATAR_SKINS) as AvatarSkinId[];
export const AVATAR_HAIR_IDS = Object.keys(AVATAR_HAIRS) as AvatarHairId[];
export const AVATAR_EYES_IDS = Object.keys(AVATAR_EYES) as AvatarEyesId[];

export const DEFAULT_AVATAR_STYLE: AvatarStyle = {
  kind: 'female',
  skin: 'light',
  hair: 'black',
  eyes: 'brown',
};

const STORAGE_KEY = 'aawaz-avatar-v1';

export function loadAvatarStyle(): AvatarStyle {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_STYLE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR_STYLE;
    const parsed = JSON.parse(raw) as Partial<AvatarStyle>;
    return {
      kind: AVATAR_KINDS.some((k) => k.id === parsed.kind) ? (parsed.kind as AvatarKindId) : DEFAULT_AVATAR_STYLE.kind,
      skin: parsed.skin && parsed.skin in AVATAR_SKINS ? (parsed.skin as AvatarSkinId) : DEFAULT_AVATAR_STYLE.skin,
      hair: parsed.hair && parsed.hair in AVATAR_HAIRS ? (parsed.hair as AvatarHairId) : DEFAULT_AVATAR_STYLE.hair,
      eyes: parsed.eyes && parsed.eyes in AVATAR_EYES ? (parsed.eyes as AvatarEyesId) : DEFAULT_AVATAR_STYLE.eyes,
    };
  } catch {
    return DEFAULT_AVATAR_STYLE;
  }
}

export function saveAvatarStyle(style: AvatarStyle) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // storage unavailable — style stays session-only
  }
}

export function randomAvatarStyle(current: AvatarStyle): AvatarStyle {
  const pick = <T,>(list: readonly T[], not: T): T => {
    const options = list.filter((item) => item !== not);
    return options[Math.floor(Math.random() * options.length)] ?? not;
  };

  return {
    kind: Math.random() < 0.5 ? 'female' : 'male',
    skin: pick(AVATAR_SKIN_IDS, current.skin),
    hair: pick(AVATAR_HAIR_IDS, current.hair),
    eyes: pick(AVATAR_EYES_IDS, current.eyes),
  };
}
