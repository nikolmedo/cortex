import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';

export interface MotionState {
  /** True while this subtree's content is arriving and entrances may play. */
  reveal: boolean;
}

/** A settled scene: what a subtree with no provider above it sees. */
const SETTLED: MotionState = { reveal: false };

const MotionContext = createContext<MotionState>(SETTLED);

/**
 * Tells a composition subtree whether it is currently revealing. Deep children
 * animate off this instead of threading `reveal` through every block.
 */
export function MotionProvider(props: { reveal: boolean; children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ reveal: props.reveal }), [props.reveal]);
  return <MotionContext.Provider value={value}>{props.children}</MotionContext.Provider>;
}

export function useMotion(): MotionState {
  return useContext(MotionContext);
}
