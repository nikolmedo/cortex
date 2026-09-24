import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { ModuleReveal } from '../../domain/Scene';

export interface MotionState {
  /** True while this subtree's content is arriving and entrances may play. */
  reveal: boolean;
  /** The enclosing card's resolved `reveal` directive, when inside a card. */
  entrance?: ModuleReveal;
  /** The enclosing card's entrance delay in ms, so inner JS motion starts with it. */
  delay: number;
}

/** A settled scene: what a subtree with no provider above it sees. */
const SETTLED: MotionState = { reveal: false, delay: 0 };

const MotionContext = createContext<MotionState>(SETTLED);

/**
 * Tells a composition subtree whether it is currently revealing. Deep children
 * animate off this instead of threading `reveal` through every block. A card
 * nests a second provider that adds its own entrance and delay.
 */
export function MotionProvider(props: {
  reveal: boolean;
  entrance?: ModuleReveal;
  delay?: number;
  children: ReactNode;
}): ReactElement {
  const { reveal, entrance, delay = 0 } = props;
  const value = useMemo(() => ({ reveal, entrance, delay }), [reveal, entrance, delay]);
  return <MotionContext.Provider value={value}>{props.children}</MotionContext.Provider>;
}

export function useMotion(): MotionState {
  return useContext(MotionContext);
}
