import type { ScenePresentation } from '../../domain/Scene';
import { DEFAULT_PALETTE, DEFAULT_PRESENTATION, isHex } from '../../domain/Scene';
import { MOOD_METRICS } from '../../layout/sceneMetrics';

/** '#00D4FF' -> '0 212 255'; falls back to the brand primary for anything that is not a 6-digit hex. */
function hexToRgbTriplet(hex: string): string {
  const safe = isHex(hex) ? hex : DEFAULT_PALETTE.primary;
  const n = parseInt(safe.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

type SceneCssVars = Record<`--${string}`, string>;

/**
 * Inline custom properties for one scene. Motion numbers come from
 * sceneMetrics.ts, the same table the layout and float loop read, so
 * simulation and stylesheet always agree. Density only affects layout
 * geometry and is exposed as data-density, not as a CSS variable.
 */
export function sceneCssVars(p: ScenePresentation): SceneCssVars {
  const mood = MOOD_METRICS[p.mood];
  const primaryRgb = hexToRgbTriplet(p.palette.primary);
  return {
    '--scene-primary': p.palette.primary,
    '--scene-secondary': p.palette.secondary,
    '--scene-accent': p.palette.accent,
    '--scene-primary-rgb': primaryRgb,
    '--scene-secondary-rgb': hexToRgbTriplet(p.palette.secondary),
    '--scene-accent-rgb': hexToRgbTriplet(p.palette.accent),
    '--accent-rgb': primaryRgb,
    '--motion-scale': String(mood.motionScale),
    '--grain-opacity': String(mood.grainOpacity),
  };
}

export function isDefaultPresentation(p: ScenePresentation): boolean {
  const d = DEFAULT_PRESENTATION;
  return (
    p.archetype === d.archetype &&
    p.mood === d.mood &&
    p.motif === d.motif &&
    p.density === d.density &&
    p.palette.primary === d.palette.primary &&
    p.palette.secondary === d.palette.secondary &&
    p.palette.accent === d.palette.accent
  );
}
