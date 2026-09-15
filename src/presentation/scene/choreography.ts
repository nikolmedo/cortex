import type { SceneArchetype, SceneMood } from '../../domain/Scene';
import { MOOD_METRICS } from '../../layout/sceneMetrics';
import type { LayoutEdge, LayoutNode, LayoutResult } from '../../layout/types';

export interface Choreography {
  /** Entrance delay per node id, in seconds, already scaled by the mood. */
  delays: Map<string, number>;
  /** Quadratic edge bow as a fraction of edge length. */
  curvature: number;
  motionScale: number;
}

/** Spine edges are near-straight; spiral edges bow the most. */
const CURVATURE: Record<SceneArchetype, number> = {
  constellation: 0.12,
  orbital: 0.18,
  spine: 0.04,
  mosaic: 0.08,
  spiral: 0.22,
};

const LEAF_STEP = 0.05;

/** 0..1 position of the node along the sweep direction the archetype reads in. */
function sweep(node: LayoutNode, layout: LayoutResult, archetype: SceneArchetype): number {
  const { bbox } = layout;
  switch (archetype) {
    case 'spine':
      return (node.x - bbox.minX) / Math.max(bbox.maxX - bbox.minX, 1);
    case 'mosaic': {
      const reach = Math.max(
        Math.hypot(bbox.minX, bbox.minY),
        Math.hypot(bbox.maxX, bbox.minY),
        Math.hypot(bbox.minX, bbox.maxY),
        Math.hypot(bbox.maxX, bbox.maxY),
        1,
      );
      return Math.hypot(node.x, node.y) / reach;
    }
    case 'orbital':
      return ((Math.atan2(node.y, node.x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
    case 'spiral':
    case 'constellation':
      return 0;
  }
}

/**
 * Per-archetype entrance order:
 * constellation — radial stagger by category index (the original choreography)
 * spine — left-to-right wave by x
 * spiral — angular sweep by category index (index is angle on the spiral)
 * mosaic — ripple outward from the center cell
 * orbital — ring by ring: center, spotlight, categories, then leaves, each swept by angle
 */
export function choreograph(layout: LayoutResult, mood: SceneMood): Choreography {
  const motionScale = MOOD_METRICS[mood].motionScale;
  const { archetype } = layout;
  const catCount = Math.max(layout.nodes.filter(n => n.kind === 'category').length, 1);
  const delays = new Map<string, number>();

  for (const node of layout.nodes) {
    const leafIndex = Math.max(node.factIndex, 0);
    let raw: number;

    if (node.kind === 'center') raw = 0.15;
    else if (node.kind === 'spotlight') raw = 0.4;
    else {
      const isLeaf = node.kind !== 'category';
      switch (archetype) {
        case 'constellation':
          raw = isLeaf ? 0.9 + node.catIndex * 0.04 + leafIndex * LEAF_STEP : 0.6 + node.catIndex * 0.09;
          break;
        case 'spine':
          raw = 0.3 + sweep(node, layout, archetype) * 0.9 + (isLeaf ? 0.15 + leafIndex * LEAF_STEP : 0);
          break;
        case 'spiral':
          raw = 0.3 + (node.catIndex / catCount) * 0.9 + (isLeaf ? 0.15 + leafIndex * 0.06 : 0);
          break;
        case 'mosaic':
          raw = 0.25 + sweep(node, layout, archetype) * 0.8 + (isLeaf ? 0.1 + leafIndex * 0.04 : 0);
          break;
        case 'orbital':
          raw = isLeaf ? 0.95 + sweep(node, layout, archetype) * 0.4 : 0.5 + sweep(node, layout, archetype) * 0.3;
          break;
      }
    }
    delays.set(node.id, raw / motionScale);
  }

  return { delays, curvature: CURVATURE[archetype], motionScale };
}

/** An edge starts drawing shortly before its target node materialises. */
export function edgeDelay(edge: LayoutEdge, delays: Map<string, number>): number {
  return Math.max((delays.get(edge.targetId) ?? 0.5) - 0.3, 0.1);
}
