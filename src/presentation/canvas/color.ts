import { DEFAULT_PALETTE, isHex, type ScenePalette } from '../../domain/Scene';

export type Rgb = [number, number, number];

export interface RgbPalette {
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
}

export function hexToRgb(hex: string, fallback: string = DEFAULT_PALETTE.primary): Rgb {
  const safe = isHex(hex) ? hex : fallback;
  const n = parseInt(safe.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function paletteToRgb(p: ScenePalette): RgbPalette {
  return {
    primary: hexToRgb(p.primary, DEFAULT_PALETTE.primary),
    secondary: hexToRgb(p.secondary, DEFAULT_PALETTE.secondary),
    accent: hexToRgb(p.accent, DEFAULT_PALETTE.accent),
  };
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Moves `current` toward `target` in place; `k` is the per-frame fraction. */
export function approachPalette(current: RgbPalette, target: RgbPalette, k: number): void {
  current.primary = mixRgb(current.primary, target.primary, k);
  current.secondary = mixRgb(current.secondary, target.secondary, k);
  current.accent = mixRgb(current.accent, target.accent, k);
}

export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** Frame-rate independent smoothing factor that covers ~95% of the distance in `ms`. */
export function smoothing(dt: number, ms: number): number {
  return 1 - Math.exp((-3 * dt) / ms);
}
