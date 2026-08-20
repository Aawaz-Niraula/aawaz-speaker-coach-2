import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AAWAX_ACCESSORIES,
  AAWAX_ACCESSORY_IDS,
  AAWAX_COLOR_IDS,
  AAWAX_COLORS,
  DEFAULT_AAWAX_STYLE,
  loadAawaxStyle,
  randomAawaxStyle,
} from './aawax';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Aawax customization options', () => {
  it('keeps every advertised color backed by a complete palette', () => {
    for (const colorId of AAWAX_COLOR_IDS) {
      const palette = AAWAX_COLORS[colorId];
      expect(palette.label).toBeTruthy();
      expect(palette.from).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.to).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.footLeft).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.footRight).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.glow).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps accessory ids and picker options in sync', () => {
    expect(AAWAX_ACCESSORY_IDS).toEqual(AAWAX_ACCESSORIES.map((accessory) => accessory.id));
    expect(new Set(AAWAX_ACCESSORY_IDS).size).toBe(AAWAX_ACCESSORY_IDS.length);
  });

  it('randomizes every visual option without changing sound', () => {
    const next = randomAawaxStyle(DEFAULT_AAWAX_STYLE);

    expect(next.design).not.toBe(DEFAULT_AAWAX_STYLE.design);
    expect(next.color).not.toBe(DEFAULT_AAWAX_STYLE.color);
    expect(next.accessory).not.toBe(DEFAULT_AAWAX_STYLE.accessory);
    expect(next.sound).toBe(DEFAULT_AAWAX_STYLE.sound);
  });

  it('loads older saved styles with the new default accessory', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ design: 'kitty', color: 'gold', sound: false }),
      },
    });

    expect(loadAawaxStyle()).toEqual({
      design: 'kitty',
      color: 'gold',
      accessory: 'none',
      sound: false,
    });
  });
});
