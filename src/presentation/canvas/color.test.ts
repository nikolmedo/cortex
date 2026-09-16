import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE } from '../../domain/Scene';
import { approachPalette, hexToRgb, mixRgb, paletteToRgb, rgba, smoothing, type Rgb } from './color';

describe('hexToRgb', () => {
  it('splits a valid hex into channels', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#7FD8FF')).toEqual([0x7f, 0xd8, 0xff]);
    expect(hexToRgb('#010203')).toEqual([1, 2, 3]);
  });

  it('is case insensitive', () => {
    expect(hexToRgb('#7fd8ff')).toEqual(hexToRgb('#7FD8FF'));
  });

  it('uses the fallback for an invalid hex', () => {
    const expected = hexToRgb(DEFAULT_PALETTE.primary);
    expect(hexToRgb('nope')).toEqual(expected);
    expect(hexToRgb('7FD8FF')).toEqual(expected);
    expect(hexToRgb('#GGGGGG')).toEqual(expected);
    expect(hexToRgb('')).toEqual(expected);
  });

  it('honours an explicit fallback', () => {
    expect(hexToRgb('nope', '#010203')).toEqual([1, 2, 3]);
  });
});

describe('paletteToRgb', () => {
  it('converts all three channels and repairs invalid entries per slot', () => {
    expect(paletteToRgb({ primary: '#010203', secondary: 'bad', accent: '#040506' })).toEqual({
      primary: [1, 2, 3],
      secondary: hexToRgb(DEFAULT_PALETTE.secondary),
      accent: [4, 5, 6],
    });
  });
});

describe('mixRgb', () => {
  const a: Rgb = [0, 0, 0];
  const b: Rgb = [100, 200, 255];

  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(mixRgb(a, b, 0)).toEqual(a);
    expect(mixRgb(a, b, 1)).toEqual(b);
  });

  it('interpolates linearly', () => {
    expect(mixRgb(a, b, 0.5)).toEqual([50, 100, 127.5]);
  });

  it('extrapolates rather than clamping t', () => {
    expect(mixRgb(a, b, 2)).toEqual([200, 400, 510]);
  });

  it('does not mutate its inputs', () => {
    mixRgb(a, b, 0.5);
    expect(a).toEqual([0, 0, 0]);
    expect(b).toEqual([100, 200, 255]);
  });
});

describe('approachPalette', () => {
  it('moves every channel toward the target in place', () => {
    const current = { primary: [0, 0, 0] as Rgb, secondary: [0, 0, 0] as Rgb, accent: [0, 0, 0] as Rgb };
    const target = { primary: [100, 100, 100] as Rgb, secondary: [200, 200, 200] as Rgb, accent: [50, 50, 50] as Rgb };
    approachPalette(current, target, 0.5);
    expect(current).toEqual({ primary: [50, 50, 50], secondary: [100, 100, 100], accent: [25, 25, 25] });
  });
});

describe('rgba', () => {
  it('truncates channels to integers', () => {
    expect(rgba([1.9, 2.9, 3.9], 1)).toBe('rgba(1, 2, 3, 1.000)');
  });

  it('formats alpha to three decimals', () => {
    expect(rgba([0, 0, 0], 0.5)).toBe('rgba(0, 0, 0, 0.500)');
    expect(rgba([0, 0, 0], 0.12345)).toBe('rgba(0, 0, 0, 0.123)');
  });

  it('clamps alpha into [0, 1]', () => {
    expect(rgba([0, 0, 0], -3)).toBe('rgba(0, 0, 0, 0.000)');
    expect(rgba([0, 0, 0], 7)).toBe('rgba(0, 0, 0, 1.000)');
    expect(rgba([0, 0, 0], Number.NaN)).toBe('rgba(0, 0, 0, NaN)');
  });
});

describe('smoothing', () => {
  it('returns 0 for a zero time step', () => {
    expect(smoothing(0, 300)).toBe(0);
  });

  it('covers about 95% of the distance over the full window', () => {
    expect(smoothing(300, 300)).toBeCloseTo(0.9502, 4);
  });

  it('grows with the time step and shrinks with a longer window', () => {
    expect(smoothing(16, 300)).toBeLessThan(smoothing(32, 300));
    expect(smoothing(16, 600)).toBeLessThan(smoothing(16, 300));
  });

  it('stays inside [0, 1) for any positive step', () => {
    for (const dt of [1, 16, 100, 1000, 100000]) {
      const k = smoothing(dt, 300);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});
