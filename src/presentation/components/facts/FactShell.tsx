import type { CSSProperties, ReactNode } from 'react';
import type { FactKind } from '../../../domain/Scene';
import { isCompositeKind, type FactBlockVariant } from './model';
import styles from './FactShell.module.css';

interface FactShellProps {
  kind: FactKind;
  variant: FactBlockVariant;
  color: string;
  children: ReactNode;
}

/**
 * Common chrome for every kind. In the graph it is the card (selectable text,
 * opts out of panning); in the dossier and on mobile it is a bare content
 * block so the host container keeps its own chrome.
 */
export function FactShell({ kind, variant, color, children }: FactShellProps) {
  const graph = variant === 'graph';
  return (
    <div
      className={styles.shell}
      style={{ '--c': color } as CSSProperties}
      data-kind={kind}
      data-variant={variant}
      data-composite={isCompositeKind(kind) || undefined}
      data-no-pan={graph || undefined}
      onClick={graph ? e => e.stopPropagation() : undefined}
    >
      {children}
    </div>
  );
}
