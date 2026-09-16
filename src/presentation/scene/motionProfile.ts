import type { SceneDensity, SceneLayout, SceneMood, ScenePresentation } from '../../domain/Scene';

/*
 * Per-turn motion identity. Every value is looked up in a table keyed on the
 * validated presentation enums, never interpolated from one: the tables are the
 * allowlist, which is what keeps model output out of CSS values entirely.
 */

export type MotionCssVars = Record<`--${string}`, string>;

/** An entrance shorter than this reads as a glitch; longer than this outlasts the read. */
const MIN_DUR_MS = 140;
const MAX_DUR_MS = 900;

/**
 * One curve per tempo. All four land on identity, so whatever the mood, an
 * entrance finishes exactly where the settled element sits.
 */
const EASE = {
  /* The house curve: a long, soft landing. */
  gentle: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /* Carries a little past the mark before settling back. */
  sprung: 'cubic-bezier(0.34, 1.12, 0.64, 1)',
  /* Unhurried at both ends; nothing accelerates. */
  soft: 'cubic-bezier(0.25, 0.75, 0.35, 1)',
  /* Brisk, with almost no tail. */
  dry: 'cubic-bezier(0.4, 0.05, 0.2, 1)',
} as const;

interface MoodMotion {
  fast: number;
  base: number;
  slow: number;
  /** Entrance travel in px; also the slide distance of the `edge` family. */
  rise: number;
  /** Entrance blur in px. */
  blur: number;
  /** Entrance scale; 1 leaves the element at its own size. */
  scale: number;
  ease: string;
}

const MOOD_MOTION: Record<SceneMood, MoodMotion> = {
  // Slower than the default, and it rises rather than snaps.
  calm: { fast: 200, base: 400, slow: 700, rise: 12, blur: 6, scale: 1, ease: EASE.gentle },
  // Quick, travels further, and grows the last fraction into place.
  kinetic: { fast: 150, base: 300, slow: 520, rise: 20, blur: 5, scale: 0.97, ease: EASE.sprung },
  // Barely travels: an archival answer develops out of the page instead of arriving at it.
  archival: { fast: 240, base: 480, slow: 880, rise: 4, blur: 10, scale: 1, ease: EASE.soft },
  // Fastest and driest; nothing lingers, because the answer may not either.
  volatile: { fast: 140, base: 260, slow: 440, rise: 14, blur: 4, scale: 1, ease: EASE.dry },
};

/** Default entrance family per layout; `Materialize` can override it per element. */
const LAYOUT_ENTER: Record<SceneLayout, string> = {
  focus: 'materialize',
  dossier: 'materialize',
  split: 'edge',
  sequence: 'unfurl',
  mosaic: 'settle',
};

/**
 * Gap between two entrances of the same batch, in ms. This is the first thing
 * `density` has ever actually controlled.
 */
export const STAGGER_BY_DENSITY: Record<SceneDensity, number> = {
  sparse: 80,
  balanced: 60,
  dense: 40,
};

/** A mosaic drops many small tiles at once; a full-length cascade would outlast the read. */
const LAYOUT_STAGGER_SCALE: Record<SceneLayout, number> = {
  focus: 1,
  dossier: 1,
  split: 1,
  sequence: 1,
  mosaic: 0.7,
};

function clampDuration(ms: number): number {
  return Math.min(MAX_DUR_MS, Math.max(MIN_DUR_MS, Math.round(ms)));
}

/** Stagger step for a turn. The CSS `--stagger` and the JS delays both read this. */
export function staggerStep(presentation: ScenePresentation): number {
  return Math.round(STAGGER_BY_DENSITY[presentation.density] * LAYOUT_STAGGER_SCALE[presentation.layout]);
}

/** The turn's motion custom properties; these override the global tokens for the scene subtree. */
export function motionFor(presentation: ScenePresentation): MotionCssVars {
  const mood = MOOD_MOTION[presentation.mood];
  return {
    '--dur-fast': `${clampDuration(mood.fast)}ms`,
    '--dur-base': `${clampDuration(mood.base)}ms`,
    '--dur-slow': `${clampDuration(mood.slow)}ms`,
    '--ease': mood.ease,
    '--enter': LAYOUT_ENTER[presentation.layout],
    '--rise': `${mood.rise}px`,
    '--reveal-blur': `${mood.blur}px`,
    '--enter-scale': String(mood.scale),
    '--stagger': `${staggerStep(presentation)}ms`,
  };
}
