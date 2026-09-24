import { useId, type ReactElement, type ReactNode } from 'react';
import type { ModulePattern } from '../../../domain/Scene';
import { hash, random } from '../../scene/seed';
import styles from './ModuleCard.module.css';

/*
 * Decoration behind a card body. The model only picks the pattern name; every
 * number drawn here comes from a hash of the seed string, so the same card
 * always gets the same field and no model text ever reaches an attribute.
 */

const W = 400;
const H = 240;

const STRIPE_ANGLES = [-60, -45, -30, 30, 45, 60];

interface CardPatternProps {
  pattern: Exclude<ModulePattern, 'none'>;
  seed: string;
}

export function CardPattern({ pattern, seed }: CardPatternProps): ReactElement {
  // Interpolated into url(#...) references, so it is reduced to characters that
  // are always valid in a fragment identifier whatever React's id format is.
  const uid = `card-pattern-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const next = random(hash(seed));
  // Where the field is brightest; it fades out from there.
  const fx = 0.15 + next() * 0.7;
  const fy = 0.1 + next() * 0.8;
  const cx = fx * W;
  const cy = fy * H;
  const tile = `${uid}-tile`;

  let defs: ReactNode = null;
  let body: ReactNode;
  if (pattern === 'contour') {
    const tilt = Math.round(next() * 180);
    const squash = 0.5 + next() * 0.25;
    body = (
      <g transform={`rotate(${tilt} ${cx.toFixed(1)} ${cy.toFixed(1)})`} fill="none" stroke="currentColor">
        {Array.from({ length: 8 }, (_, i) => {
          const rx = 22 + i * (26 + next() * 6);
          return <ellipse key={i} cx={cx} cy={cy} rx={rx.toFixed(1)} ry={(rx * squash).toFixed(1)} vectorEffect="non-scaling-stroke" />;
        })}
      </g>
    );
  } else if (pattern === 'grid') {
    const cell = 20 + Math.round(next() * 3) * 4;
    defs = (
      <pattern id={tile} width={cell} height={cell} patternUnits="userSpaceOnUse">
        <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke="currentColor" strokeWidth="0.75" />
      </pattern>
    );
    body = (
      <>
        <rect width={W} height={H} fill={`url(#${tile})`} />
        <g stroke="currentColor" strokeWidth="1.5" opacity="0.8">
          <line x1={cx} x2={cx} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={cy} y2={cy} vectorEffect="non-scaling-stroke" />
        </g>
      </>
    );
  } else if (pattern === 'dots') {
    const gap = 10 + Math.round(next() * 3) * 2;
    defs = (
      <pattern id={tile} width={gap} height={gap} patternUnits="userSpaceOnUse">
        <circle cx={gap / 2} cy={gap / 2} r="1.1" fill="currentColor" />
      </pattern>
    );
    body = <rect width={W} height={H} fill={`url(#${tile})`} />;
  } else if (pattern === 'stripes') {
    const angle = STRIPE_ANGLES[Math.floor(next() * STRIPE_ANGLES.length)];
    const gap = 8 + Math.round(next() * 2) * 3;
    defs = (
      <pattern id={tile} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
        <line x1="0" x2="0" y1="0" y2={gap} stroke="currentColor" strokeWidth="1" />
      </pattern>
    );
    body = <rect width={W} height={H} fill={`url(#${tile})`} />;
  } else {
    defs = (
      <pattern id={tile} width={W} height="4" patternUnits="userSpaceOnUse">
        <rect width={W} height="1" fill="currentColor" />
      </pattern>
    );
    body = (
      <>
        <rect width={W} height={H} fill={`url(#${tile})`} />
        <rect y={(cy - 9).toFixed(1)} width={W} height="18" fill="currentColor" opacity="0.35" />
      </>
    );
  }

  return (
    <span className={styles.pattern} data-pattern={pattern} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id={`${uid}-fade`} cx={fx.toFixed(3)} cy={fy.toFixed(3)} r="0.8">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${uid}-mask`}>
            <rect width={W} height={H} fill={`url(#${uid}-fade)`} />
          </mask>
          {defs}
        </defs>
        <g mask={`url(#${uid}-mask)`}>{body}</g>
      </svg>
    </span>
  );
}
