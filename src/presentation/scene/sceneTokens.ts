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
 * The primary is the scene's signal colour and keeps its full hue. The other
 * two are pulled part of the way to steel and paper: enough hue left to pair
 * with the signal in fills (--signal-grad), not enough to turn the page into a
 * three-colour scheme. The hex is validated first; the mix targets are constants.
 */
const STEEL = '#b4c0c6';
const PAPER = '#e6ecee';

function muted(hex: string, share: number, toward: string): string {
  return `color-mix(in srgb, ${hex} ${share}%, ${toward})`;
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
    // Redeclared here because a var() on :root resolves there, so the :root
    // --signal would keep the default hue instead of following this turn.
    '--signal': safeHex(palette.primary, DEFAULT_PALETTE.primary),
    '--scene-secondary': muted(safeHex(palette.secondary, DEFAULT_PALETTE.secondary), 55, STEEL),
    '--scene-accent': muted(safeHex(palette.accent, DEFAULT_PALETTE.accent), 60, PAPER),
    ...motionFor(presentation),
  };
}
