/*
 * Motion identity. The easing curve and the 180/360/640 ms durations live in
 * tokens.css (--ease, --dur-*); this module only computes entrance staggers.
 */

export const STAGGER_STEP_MS = 60;
export const STAGGER_CAP_MS = 400;

/** Entrance delay for the n-th element of a batch, never beyond the cap. */
export function staggerDelay(index: number, step: number = STAGGER_STEP_MS): number {
  return Math.min(Math.max(0, index) * step, STAGGER_CAP_MS);
}
