import { useEffect, useState } from 'react';

/*
 * When a composition's entrances may play. They play while content arrives,
 * then for `tailMs` more, as long as the last batch can still be drawing. After
 * that the turn is settled for good, so a card that remounts (moving between
 * rail and main across a breakpoint) renders in place instead of replaying.
 */

/**
 * The hold's effect body, kept out of the hook so it can be driven without a DOM.
 * Arrival holds; once arrival ends, a running hold lapses after `tailMs`.
 */
export function scheduleHold(
  arriving: boolean,
  holding: boolean,
  tailMs: number,
  setHolding: (holding: boolean) => void,
): (() => void) | undefined {
  if (arriving) {
    setHolding(true);
    return undefined;
  }
  if (!holding) return undefined;
  const timer = globalThis.setTimeout(() => setHolding(false), tailMs);
  return () => globalThis.clearTimeout(timer);
}

/** One boolean settles whether anything moves. */
export function entrancesPlay(reveal: boolean, arriving: boolean, holding: boolean, reduced: boolean): boolean {
  return reveal && (arriving || holding) && !reduced;
}

/**
 * `reveal`: this is the latest turn and this view watched it arrive.
 * `live`: the turn is still in flight. The hold is seeded from `reveal`, so a
 * turn that resolved in the same update its scene arrived still plays once.
 */
export function useRevealHold(reveal: boolean, live: boolean, reduced: boolean, tailMs: number): boolean {
  const [holding, setHolding] = useState(reveal);
  const arriving = reveal && live;
  useEffect(() => scheduleHold(arriving, holding, tailMs, setHolding), [arriving, holding, tailMs]);
  return entrancesPlay(reveal, arriving, holding, reduced);
}
