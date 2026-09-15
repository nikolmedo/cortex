import type { FactKind, Scene, SceneArchetype, SceneMood } from '../../domain/Scene';
import { categoryKind } from '../../domain/Scene';

export type ArchetypeLabelKey = `scene.archetype.${SceneArchetype}`;
export type MoodLabelKey = `scene.mood.${SceneMood}`;

export interface SceneSignature {
  archetypeLabelKey: ArchetypeLabelKey;
  moodLabelKey: MoodLabelKey;
  /** Distinct fact kinds in order of first appearance. */
  kinds: FactKind[];
}

export function sceneSignature(scene: Scene): SceneSignature {
  const kinds: FactKind[] = [];
  for (const cat of scene.graph) {
    const kind = categoryKind(cat);
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  return {
    archetypeLabelKey: `scene.archetype.${scene.presentation.archetype}`,
    moodLabelKey: `scene.mood.${scene.presentation.mood}`,
    kinds,
  };
}
