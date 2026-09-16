import type { ReactElement } from 'react';
import type { SceneLayout } from '../../../domain/Scene';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Shapes the placeholder like the composition the preface announced. */
  layout: SceneLayout;
  /** A single module-sized placeholder (content still arriving). */
  compact?: boolean;
}

export function Skeleton({ layout, compact = false }: SkeletonProps): ReactElement {
  if (compact) {
    return (
      <div className={styles.skeleton} aria-hidden="true">
        <span className={styles.bone} data-shape="card" />
      </div>
    );
  }
  return (
    <div className={styles.skeleton} data-layout={layout} aria-hidden="true">
      <span className={styles.bone} data-shape="title" />
      <span className={styles.bone} data-shape="line" />
      <span className={styles.bone} data-shape="line-short" />
      <div className={styles.grid}>
        <span className={styles.bone} data-shape="card" />
        <span className={styles.bone} data-shape="card" />
        <span className={styles.bone} data-shape="card" />
      </div>
    </div>
  );
}
