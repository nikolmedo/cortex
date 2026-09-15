import { createContext, useContext, useMemo, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { Scene, ScenePalette, ScenePresentation } from '../../domain/Scene';
import { DEFAULT_PRESENTATION } from '../../domain/Scene';
import { isDefaultPresentation, sceneCssVars } from './sceneTokens';
import styles from './SceneTheme.module.css';

export interface SceneThemeValue {
  presentation: ScenePresentation;
  palette: ScenePalette;
  /** Primary palette color; the hue every hairline, glow and tint follows. */
  accent: string;
  /** True when no scene is mounted or the scene uses the brand defaults. */
  isDefault: boolean;
}

const DEFAULT_VALUE: SceneThemeValue = {
  presentation: DEFAULT_PRESENTATION,
  palette: DEFAULT_PRESENTATION.palette,
  accent: DEFAULT_PRESENTATION.palette.primary,
  isDefault: true,
};

const SceneThemeContext = createContext<SceneThemeValue>(DEFAULT_VALUE);

/**
 * Writes the scene presentation as CSS custom properties on a `display: contents`
 * wrapper and exposes it through context. Background layers and graph nodes read
 * the context themselves; consumers only need to mount this once around the app.
 */
export function SceneTheme({ scene, children }: { scene: Scene | null; children: ReactNode }): ReactElement {
  const presentation = scene?.presentation ?? DEFAULT_PRESENTATION;

  const value = useMemo<SceneThemeValue>(
    () => ({
      presentation,
      palette: presentation.palette,
      accent: presentation.palette.primary,
      isDefault: scene == null || isDefaultPresentation(presentation),
    }),
    [scene, presentation],
  );

  const style = useMemo(() => sceneCssVars(presentation) as CSSProperties, [presentation]);

  return (
    <SceneThemeContext.Provider value={value}>
      <div
        className={styles.root}
        style={style}
        data-archetype={presentation.archetype}
        data-mood={presentation.mood}
        data-motif={presentation.motif}
        data-density={presentation.density}
      >
        {children}
      </div>
    </SceneThemeContext.Provider>
  );
}

/** Safe outside the provider: returns the brand defaults. */
export function useSceneTheme(): SceneThemeValue {
  return useContext(SceneThemeContext);
}
