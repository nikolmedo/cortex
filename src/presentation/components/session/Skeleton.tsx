import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
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

/** Longest a placeholder may linger if its fade never reports back. */
const LINGER_MAX_MS = 700;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface LingeringProps {
  /** Wanted on screen. */
  show: boolean;
  /** Hand over with a fade; false (settled turn, reduced motion) removes it at once. */
  fade: boolean;
  className?: string;
  span?: string;
  children: ReactNode;
}

/**
 * Keeps a placeholder for one short fade after it stops being wanted. It is
 * lifted out of the flow at the box it last held, so the content replacing it
 * takes the space immediately and the two crossfade instead of the placeholder
 * popping out from under it.
 */
export function Lingering({ show, fade, className, span, children }: LingeringProps): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<Box | null>(null);
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>(show ? 'shown' : 'gone');

  if (show && phase !== 'shown') setPhase('shown');
  else if (!show && phase === 'shown') setPhase(fade && box.current ? 'leaving' : 'gone');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!show || !el) return;
    box.current = { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight };
  });

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const timer = window.setTimeout(() => setPhase('gone'), LINGER_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone' && !show) return null;
  const leaving = phase === 'leaving' && !show && box.current !== null;
  const style: CSSProperties | undefined = leaving && box.current
    ? { position: 'absolute', top: box.current.top, left: box.current.left, width: box.current.width, height: box.current.height }
    : undefined;

  return (
    <div
      ref={ref}
      className={[className, leaving ? styles.leaving : ''].filter(Boolean).join(' ')}
      data-span={span}
      style={style}
      aria-hidden={leaving || undefined}
      onAnimationEnd={e => {
        if (leaving && e.target === e.currentTarget) setPhase('gone');
      }}
    >
      {children}
    </div>
  );
}
