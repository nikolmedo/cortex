import type { ReactElement, ReactNode } from 'react';
import { staggerDelay } from '../../motion/motion';
import styles from './Materialize.module.css';

interface MaterializeProps {
  /** Position within the batch that arrived together; drives the capped stagger. */
  index: number;
  /** False renders the content in place with no entrance (settled or reduced motion). */
  active: boolean;
  /** Layout hint read by composition grids. */
  span?: string;
  className?: string;
  children: ReactNode;
}

/** Entrance: rise, un-blur and fade in, once, on mount. */
export function Materialize({ index, active, span, className, children }: MaterializeProps): ReactElement {
  const classes = [styles.item, active ? styles.enter : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      data-span={span}
      style={active ? { animationDelay: `${staggerDelay(index)}ms` } : undefined}
    >
      {children}
    </div>
  );
}
