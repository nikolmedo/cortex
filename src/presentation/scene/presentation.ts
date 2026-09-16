import type { Turn } from '../../application/useCortex';
import { DEFAULT_PRESENTATION, type ScenePresentation } from '../../domain/Scene';

/**
 * Presentation a turn should wear right now: the scene's own once it exists,
 * otherwise the preface's first read (layout, mood, palette), otherwise the defaults.
 */
export function turnPresentation(turn: Turn | undefined): ScenePresentation {
  if (turn?.scene) return turn.scene.presentation;
  if (turn?.preface) {
    return {
      ...DEFAULT_PRESENTATION,
      layout: turn.preface.layout,
      mood: turn.preface.mood,
      palette: turn.preface.palette,
    };
  }
  return DEFAULT_PRESENTATION;
}
