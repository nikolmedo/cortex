import type { Scene } from '../domain/Scene';
import { categoryKind } from '../domain/Scene';
import { categoryItems, isCompositeKind } from '../presentation/components/facts/model';
import type { LayoutEdge, NodeSpec } from './types';

export interface GraphSpec {
  nodes: NodeSpec[];
  edges: LayoutEdge[];
}

const CENTER_ID = 'center';
const SPOTLIGHT_ID = 'spotlight';

/**
 * Flattens a Scene into the node/edge lists the simulation and the stage
 * share. Composite kinds contribute one block node per category; every
 * other kind contributes one fact node per item.
 */
export function buildGraphSpec(scene: Scene): GraphSpec {
  const primary = scene.presentation.palette.primary;
  const nodes: NodeSpec[] = [{ id: CENTER_ID, kind: 'center', color: primary, catIndex: -1, factIndex: -1 }];
  const edges: LayoutEdge[] = [];

  if (scene.spotlight) {
    nodes.push({ id: SPOTLIGHT_ID, kind: 'spotlight', color: scene.presentation.palette.accent, catIndex: -1, factIndex: -1 });
    edges.push({
      id: 'e-s',
      sourceId: CENTER_ID,
      targetId: SPOTLIGHT_ID,
      color: scene.presentation.palette.accent,
      role: 'spotlight',
      catIndex: -1,
      factIndex: -1,
    });
  }

  scene.graph.forEach((cat, i) => {
    const color = cat.color || primary;
    const catId = `cat-${i}`;
    nodes.push({ id: catId, kind: 'category', color, catIndex: i, factIndex: -1 });
    edges.push({ id: `e-c-${i}`, sourceId: CENTER_ID, targetId: catId, color, role: 'trunk', catIndex: i, factIndex: -1 });

    if (isCompositeKind(categoryKind(cat))) {
      const id = `block-${i}`;
      nodes.push({ id, kind: 'block', color, catIndex: i, factIndex: -1 });
      edges.push({ id: `e-b-${i}`, sourceId: catId, targetId: id, color, role: 'leaf', catIndex: i, factIndex: 0 });
      return;
    }

    categoryItems(cat).forEach((_, j) => {
      const id = `fact-${i}-${j}`;
      nodes.push({ id, kind: 'fact', color, catIndex: i, factIndex: j });
      edges.push({ id: `e-f-${i}-${j}`, sourceId: catId, targetId: id, color, role: 'leaf', catIndex: i, factIndex: j });
    });
  });

  return { nodes, edges };
}
