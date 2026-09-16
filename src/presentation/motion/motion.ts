/*
 * Motion identity. The fallback curve and durations live in tokens.css (--ease,
 * --dur-*) and are replaced per turn by motionProfile; this module only computes
 * entrance staggers. The default step comes from the same table that emits
 * `--stagger`, so a JS delay and a CSS one can never drift apart.
 */

import { STAGGER_BY_DENSITY } from '../scene/motionProfile';

export const STAGGER_STEP_MS = STAGGER_BY_DENSITY.balanced;
export const STAGGER_CAP_MS = 400;

/** Entrance delay for the n-th element of a batch, never beyond the cap. */
export function staggerDelay(index: number, step: number = STAGGER_STEP_MS): number {
  return Math.min(Math.max(0, index) * step, STAGGER_CAP_MS);
}
