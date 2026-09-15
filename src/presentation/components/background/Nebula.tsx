import styles from './Nebula.module.css';

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>`,
);

/** Three drifting blobs tinted by the scene palette (via CSS tokens) plus film grain scaled by mood. */
export function Nebula() {
  return (
    <div className={styles.root} aria-hidden>
      <div className={styles.blobPrimary} />
      <div className={styles.blobSecondary} />
      <div className={styles.blobAccent} />
      <div
        className={styles.grain}
        style={{ backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")` }}
      />
    </div>
  );
}
