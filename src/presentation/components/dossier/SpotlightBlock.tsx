import type { CSSProperties } from 'react';
import type { SceneSpotlight } from '../../../domain/Scene';
import styles from './SpotlightBlock.module.css';

interface SpotlightBlockProps {
  spotlight: SceneSpotlight;
  /** Validated hex. */
  color: string;
}

export function spotlightText(spotlight: SceneSpotlight): string {
  const line = spotlight.value ? `${spotlight.value} — ${spotlight.label}` : spotlight.label;
  return spotlight.source ? `${line} (${spotlight.source})` : line;
}

export function SpotlightBlock({ spotlight, color }: SpotlightBlockProps) {
  const style = { '--c': color } as CSSProperties;

  if (spotlight.kind === 'stat') {
    return (
      <figure className={styles.stat} style={style} data-kind="stat">
        {spotlight.value && <div className={styles.statValue}>{spotlight.value}</div>}
        <figcaption className={styles.statLabel}>{spotlight.label}</figcaption>
        {spotlight.source && <div className={styles.source}>{spotlight.source}</div>}
      </figure>
    );
  }

  if (spotlight.kind === 'quote') {
    return (
      <figure className={styles.quote} style={style} data-kind="quote">
        <blockquote className={styles.quoteText}>{spotlight.label}</blockquote>
        {(spotlight.source || spotlight.value) && (
          <figcaption className={styles.attribution}>
            {spotlight.source && <span>{spotlight.source}</span>}
            {spotlight.value && <span className={styles.attributionValue}>{spotlight.value}</span>}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className={styles.callout} style={style} data-kind="callout" role="note">
      <p className={styles.calloutText}>
        {spotlight.value && <strong className={styles.calloutValue}>{spotlight.value}</strong>}
        {spotlight.label}
      </p>
      {spotlight.source && <div className={styles.source}>{spotlight.source}</div>}
    </div>
  );
}
