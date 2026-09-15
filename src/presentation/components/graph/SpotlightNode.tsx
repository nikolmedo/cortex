import type { CSSProperties } from 'react';
import type { SceneSpotlight } from '../../../domain/Scene';
import styles from './SpotlightNode.module.css';

interface SpotlightNodeProps {
  spotlight: SceneSpotlight;
  color: string;
  onClick?: () => void;
}

/** Headline node linked to the center: a big stat, a pull quote, or a callout. */
export function SpotlightNode({ spotlight, color, onClick }: SpotlightNodeProps) {
  const { kind, label, value, source } = spotlight;

  return (
    <div
      className={styles.root}
      style={{ '--c': color } as CSSProperties}
      data-kind={kind}
      data-no-pan
      role={onClick ? 'button' : undefined}
      onClick={e => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {kind === 'stat' && (
        <>
          <span className={styles.label}>{label}</span>
          {value ? <span className={styles.value}>{value}</span> : null}
        </>
      )}
      {kind === 'quote' && (
        <blockquote className={styles.quote}>
          <p className={styles.body}>{label}</p>
          {value ? <p className={styles.bodyMuted}>{value}</p> : null}
        </blockquote>
      )}
      {kind === 'callout' && (
        <>
          <span className={styles.headline}>{label}</span>
          {value ? <p className={styles.body}>{value}</p> : null}
        </>
      )}
      {source ? <span className={styles.source}>{source}</span> : null}
    </div>
  );
}
