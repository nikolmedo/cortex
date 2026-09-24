import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { staggerDelay } from '../../motion/motion';
import { familyVars, type EnterFamily } from '../../scene/motionProfile';
import styles from './Materialize.module.css';

/**
 * A family from motionProfile, or `fade`: the rise with its travel taken out,
 * for an element that should simply appear.
 */
export type MaterializeVariant = EnterFamily | 'fade';

function variantVars(variant: MaterializeVariant): Record<string, string> {
  if (variant === 'fade') return { ...familyVars('rise'), '--rise': '0px', '--enter-scale': '1' };
  return familyVars(variant);
}

interface MaterializeProps {
  /** Position within the batch that arrived together; drives the capped stagger. */
  index: number;
  /** False renders the content in place with no entrance (settled or reduced motion). */
  active: boolean;
  /** Layout hint read by composition grids. */
  span?: string;
  /** Finer width hint on the 12-column module row; wins over `span` where set. */
  size?: string;
  /** Columns taken on the 12-column module row, computed in items.ts; wins over `span` and `size`. */
  cols?: number;
  /** Overrides the scene's entrance family for this one element. */
  variant?: MaterializeVariant;
  /** Stagger step in ms; defaults to the balanced-density step. */
  step?: number;
  /** Identity for the layout-shift animation (useFlip). */
  flipKey?: string | number;
  className?: string;
  children: ReactNode;
}

/**
 * Entrance, once, on mount. The delay is published as --enter-delay so the
 * draws inside the element (bars, nodes, phrases) start from the moment it does.
 */
export function Materialize({
  index, active, span, size, cols, variant, step, flipKey, className, children,
}: MaterializeProps): ReactElement {
  const classes = [styles.item, active ? styles.enter : '', className ?? ''].filter(Boolean).join(' ');
  // Only ever a clamped integer computed in code, so no model text reaches the style.
  const columns = cols !== undefined && Number.isInteger(cols) && cols >= 1 && cols <= 12 ? cols : undefined;
  const vars = {
    ...(columns !== undefined ? { '--cols': String(columns) } : null),
    ...(active ? { '--enter-delay': `${staggerDelay(index, step)}ms`, ...(variant ? variantVars(variant) : null) } : null),
  };
  const style = Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;

  return (
    <div
      className={classes}
      data-span={span}
      data-size={size}
      data-cols={columns}
      data-flip={flipKey}
      style={style}
    >
      {children}
    </div>
  );
}
