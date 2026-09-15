import type { SceneDensity, SceneMood } from '../domain/Scene';

/*
 * Numeric side of the scene presentation. The layout engine and the float
 * loop read these directly; sceneTokens.ts mirrors motionScale and
 * grainOpacity as --motion-scale / --grain-opacity so stylesheets and the
 * simulation never disagree. Density metrics stay layout-only.
 */

interface MoodMetrics {
  /** Speed multiplier for entrance, ambient and edge animation (1 = neutral). */
  motionScale: number;
  /** Requested float drift amplitude in px (clamped below half the collision padding). */
  floatAmp: number;
  grainOpacity: number;
}

interface DensityMetrics {
  /** Multiplier on the category orbit radius. */
  orbit: number;
  /** Multiplier on category-to-leaf link distance. */
  link: number;
  /** Collision padding in px. */
  padding: number;
}

export const MOOD_METRICS: Record<SceneMood, MoodMetrics> = {
  calm: { motionScale: 0.7, floatAmp: 3, grainOpacity: 0.05 },
  kinetic: { motionScale: 1.3, floatAmp: 6, grainOpacity: 0.06 },
  archival: { motionScale: 0.5, floatAmp: 1.5, grainOpacity: 0.09 },
  volatile: { motionScale: 1.6, floatAmp: 9, grainOpacity: 0.08 },
};

export const DENSITY_METRICS: Record<SceneDensity, DensityMetrics> = {
  sparse: { orbit: 1.3, link: 1.25, padding: 20 },
  balanced: { orbit: 1, link: 1, padding: 14 },
  dense: { orbit: 0.82, link: 0.8, padding: 10 },
};

/**
 * Drift amplitude that can never produce visual overlap for this density:
 * two neighbours drift independently, so the amplitude stays below half the
 * collision padding.
 */
export function floatAmplitude(mood: SceneMood, density: SceneDensity): number {
  return Math.min(MOOD_METRICS[mood].floatAmp, DENSITY_METRICS[density].padding / 2 - 1);
}
