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
 * Scopes one turn's palette as inline custom properties. The palette properties
 * are registered (@property) so a preface-to-scene change crossfades.
 */
export function SceneTheme({ presentation, className, children }: SceneThemeProps): ReactElement {
  const { palette } = presentation;
  const style = useMemo(() => sceneCssVars(palette) as CSSProperties, [palette]);

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
