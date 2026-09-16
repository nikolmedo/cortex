import { useMemo, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { ScenePresentation } from '../../domain/Scene';
import { sceneCssVars } from './sceneTokens';
import styles from './SceneTheme.module.css';

interface SceneThemeProps {
  presentation: ScenePresentation;
  className?: string;
  children: ReactNode;
}

/**
 * Scopes one turn's palette and motion identity as inline custom properties.
 * The palette properties are registered (@property) so a preface-to-scene change
 * crossfades; the motion properties deliberately stay out of the transition list
 * below, since animating a duration would smear the very entrance it times.
 */
export function SceneTheme({ presentation, className, children }: SceneThemeProps): ReactElement {
  const style = useMemo(() => sceneCssVars(presentation) as CSSProperties, [presentation]);

  return (
    <div
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
      data-layout={presentation.layout}
      data-mood={presentation.mood}
      data-motif={presentation.motif}
      data-density={presentation.density}
    >
      {children}
    </div>
  );
}
