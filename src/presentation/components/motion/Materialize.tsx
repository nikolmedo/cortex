import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { staggerDelay } from '../../motion/motion';
import styles from './Materialize.module.css';

/** The entrance families defined in global.css. The map is the allowlist. */
const ENTER_KEYFRAMES = {
  materialize: 'materialize',
  settle: 'settle',
  unfurl: 'unfurl',
  edge: 'edge',
} as const;

export type MaterializeVariant = keyof typeof ENTER_KEYFRAMES;

interface MaterializeProps {
  /** Position within the batch that arrived together; drives the capped stagger. */
  index: number;
  /** False renders the content in place with no entrance (settled or reduced motion). */
  active: boolean;
  /** Layout hint read by composition grids. */
  span?: string;
  /** Overrides the layout's entrance family for this one element. */
  variant?: MaterializeVariant;
  /** Stagger step in ms; defaults to the balanced-density step. */
  step?: number;
  className?: string;
  children: ReactNode;
}

/** Entrance: travels, un-blurs and fades in, once, on mount. */
export function Materialize({ index, active, span, variant, step, className, children }: MaterializeProps): ReactElement {
  const classes = [styles.item, active ? styles.enter : '', className ?? ''].filter(Boolean).join(' ');
  const style = active
    ? ({
      animationDelay: `${staggerDelay(index, step)}ms`,
      ...(variant ? { '--enter': ENTER_KEYFRAMES[variant] } : null),
    } as CSSProperties)
    : undefined;

  return (
    <div className={classes} data-span={span} style={style}>
      {children}
    </div>
  );
}
