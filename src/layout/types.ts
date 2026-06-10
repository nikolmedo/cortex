export type NodeKind = 'center' | 'category' | 'fact';

export interface LayoutNode {
  id: string;
  kind: NodeKind;
  /** Measured rectangle size used for collision; the rendered node must match. */
  w: number;
  h: number;
  /** Settled position (rectangle center) in stage coordinates. */
  x: number;
  y: number;
  color: string;
  /** -1 for the center node. */
  catIndex: number;
  /** -1 for center and category nodes. */
  factIndex: number;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
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
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  bbox: BBox;
}
