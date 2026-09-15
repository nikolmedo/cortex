import type { SceneArchetype } from '../domain/Scene';

/**
 * Node roles in the stage graph:
 * - center: the entity node (fixed at the origin)
 * - spotlight: optional headline stat/quote/callout linked to the center
 * - category: one per scene category
 * - fact: one per item for non-composite kinds
 * - block: one composite node per category for timeline/comparison/ranking/progress
 */
export type NodeKind = 'center' | 'spotlight' | 'category' | 'fact' | 'block';

type EdgeRole = 'trunk' | 'leaf' | 'spotlight';

export interface NodeSpec {
  id: string;
  kind: NodeKind;
  color: string;
  /** -1 for the center and spotlight nodes. */
  catIndex: number;
  /** Item index for fact nodes; -1 for every other role. */
  factIndex: number;
}

export interface NodeSize {
  w: number;
  h: number;
}

/** Measured rectangle per node id; the rendered node must match these metrics. */
export type NodeSizes = ReadonlyMap<string, NodeSize>;

export interface LayoutNode extends NodeSpec, NodeSize {
  /** Settled position (rectangle center) in stage coordinates. */
  x: number;
  y: number;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
  role: EdgeRole;
  catIndex: number;
  factIndex: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LayoutResult {
  archetype: SceneArchetype;
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  bbox: BBox;
  /** Collision padding the layout was solved with; float amplitude must stay below it. */
  padding: number;
}
