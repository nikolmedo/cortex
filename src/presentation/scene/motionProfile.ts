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
  /* Brisk, with almost no tail. Still an ease-out: entrances never start slow. */
  dry: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const;

interface MoodMotion {
  fast: number;
  base: number;
  slow: number;
  /** Entrance travel in px; also the slide distance of the `wipe` family. */
  rise: number;
  /** Entrance scale; 1 leaves the element at its own size. */
  scale: number;
  ease: string;
}

const MOOD_MOTION: Record<SceneMood, MoodMotion> = {
  // Slower than the default, and it rises rather than snaps.
  calm: { fast: 200, base: 400, slow: 700, rise: 12, scale: 1, ease: EASE.gentle },
  // Quick, travels further, and grows the last fraction into place.
  kinetic: { fast: 150, base: 300, slow: 520, rise: 20, scale: 0.97, ease: EASE.sprung },
  // Barely travels: an archival answer develops out of the page instead of arriving at it.
  archival: { fast: 240, base: 480, slow: 880, rise: 4, scale: 1, ease: EASE.soft },
  // Fastest and driest; nothing lingers, because the answer may not either.
  volatile: { fast: 140, base: 260, slow: 440, rise: 14, scale: 1, ease: EASE.dry },
};

/**
 * The entrance families in global.css. Each one is a keyframe for the element
 * plus, for two of them, a trace drawn by a pseudo-element on top of it: the
 * scan line and the lock-on hairlines. A family always names all three, so an
 * override on one element can never inherit a trace from the scene default.
 */
export const ENTER_FAMILIES = {
  /* Opacity and travel: the plain arrival. */
  rise: { enter: 'materialize', scan: 'none', lock: 'none' },
  /* A clip opening from the inline start: a side sliding into view. */
  wipe: { enter: 'wipeIn', scan: 'none', lock: 'none' },
  /* A clip unfolding diagonally from the top-left corner, like a notched panel. */
  unfold: { enter: 'unfoldIn', scan: 'none', lock: 'none' },
  /* A luminous line sweeps down and the content is revealed behind it. */
  scan: { enter: 'scanIn', scan: 'scanLine', lock: 'none' },
  /* Grows the last 4% into place while its frame draws in. */
  lock: { enter: 'lockIn', scan: 'none', lock: 'lockTrace' },
} as const;

export type EnterFamily = keyof typeof ENTER_FAMILIES;

/** The three custom properties that select a family; values come from the table only. */
export function familyVars(family: EnterFamily): MotionCssVars {
  const f = ENTER_FAMILIES[family];
  return { '--enter': f.enter, '--enter-scan': f.scan, '--enter-lock': f.lock };
}

/**
 * Default family per layout and mood. The layout says what the answer is shaped
 * like and the mood how it arrives, so both change what moves: an archival
 * answer is always read in by the scan, a kinetic one locks on unless it is a
 * pair of sides, and a calm one takes the gesture its layout suggests.
 */
const ENTER_TABLE: Record<SceneLayout, Record<SceneMood, EnterFamily>> = {
  focus: { calm: 'rise', kinetic: 'lock', archival: 'scan', volatile: 'wipe' },
  dossier: { calm: 'unfold', kinetic: 'lock', archival: 'scan', volatile: 'wipe' },
  split: { calm: 'wipe', kinetic: 'wipe', archival: 'scan', volatile: 'wipe' },
  sequence: { calm: 'scan', kinetic: 'rise', archival: 'scan', volatile: 'rise' },
  mosaic: { calm: 'unfold', kinetic: 'lock', archival: 'scan', volatile: 'lock' },
};

export function enterFamily(presentation: ScenePresentation): EnterFamily {
  return ENTER_TABLE[presentation.layout][presentation.mood];
}

/**
 * The longest an inner cascade may run: bars, nodes and phrases inside one card
 * stop staggering after this, so a long list lands with the rest of the turn.
 */
export const CASCADE_CAP_MS = 240;

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
    ...familyVars(enterFamily(presentation)),
    '--rise': `${mood.rise}px`,
    '--enter-scale': String(mood.scale),
    '--stagger': `${staggerStep(presentation)}ms`,
    '--cascade': `${CASCADE_CAP_MS}ms`,
  };
}
