import type { ScenePalette, SceneMood } from '../../domain/Scene';
import { DEFAULT_PALETTE, isHex } from '../../domain/Scene';

/** Ambient field speed multiplier per mood (1 = neutral). */
export const MOOD_SPEED: Record<SceneMood, number> = {
  calm: 0.7,
  kinetic: 1.25,
  archival: 0.5,
  volatile: 1.5,
};

type SceneCssVars = Record<`--${string}`, string>;

function safeHex(value: string, fallback: string): string {
  return isHex(value) ? value : fallback;
}

/** Validated palette colors only; these are the sole model values allowed into CSS. */
export function sceneCssVars(palette: ScenePalette): SceneCssVars {
  return {
    '--scene-primary': safeHex(palette.primary, DEFAULT_PALETTE.primary),
    '--scene-secondary': safeHex(palette.secondary, DEFAULT_PALETTE.secondary),
    '--scene-accent': safeHex(palette.accent, DEFAULT_PALETTE.accent),
  };
}
