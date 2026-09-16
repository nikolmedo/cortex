import type { ScenePresentation, SceneMood } from '../../domain/Scene';
import { DEFAULT_PALETTE, isHex } from '../../domain/Scene';
import { motionFor } from './motionProfile';

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

/**
 * The turn's whole CSS surface: validated palette colors plus the motion
 * properties looked up from the mood/density/layout tables. Both halves are
 * closed sets, so these stay the sole model-derived values reaching CSS.
 */
export function sceneCssVars(presentation: ScenePresentation): SceneCssVars {
  const { palette } = presentation;
  return {
    '--scene-primary': safeHex(palette.primary, DEFAULT_PALETTE.primary),
    '--scene-secondary': safeHex(palette.secondary, DEFAULT_PALETTE.secondary),
    '--scene-accent': safeHex(palette.accent, DEFAULT_PALETTE.accent),
    ...motionFor(presentation),
  };
}
