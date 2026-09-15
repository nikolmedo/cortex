/*
 * Color values must stay in sync with the CSS custom properties in
 * src/presentation/styles/tokens.css — TS needs them for SVG/canvas attrs.
 *
 * These are the brand defaults only. Per-scene colors (palette, accent) come
 * from the SceneTheme context (src/presentation/scene/SceneTheme.tsx), never
 * from here; components inside a scene should read useSceneTheme().
 */
export const BG = '#030712';
export const CYAN = '#00D4FF';
export const PURPLE = '#7B2FBE';
export const MAGENTA = '#FF3C6E';

export const TOP_BAR_H = 56;
