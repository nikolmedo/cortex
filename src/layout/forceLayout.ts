import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { CYAN } from '../infrastructure/constants';
import type { GraphData } from '../domain/GraphData';
import {
  CATEGORY_H,
  CATEGORY_W,
  CENTER_H,
  CENTER_W,
  FACT_CARD_W,
  measureFactHeight,
} from './measure';
import { rectCollide } from './rectCollide';
import type { BBox, LayoutEdge, LayoutNode, LayoutResult, NodeKind } from './types';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  w: number;
  h: number;
  color: string;
  catIndex: number;
  factIndex: number;
}

const CATEGORY_ORBIT = 300;
const FACT_LINK_DIST = 170;
const SETTLE_TICKS = 320;

export function computeBBox(nodes: LayoutNode[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.w / 2);
    minY = Math.min(minY, n.y - n.h / 2);
    maxX = Math.max(maxX, n.x + n.w / 2);
    maxY = Math.max(maxY, n.y + n.h / 2);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Builds the node/edge lists from a GraphData tree and settles a force
 * simulation synchronously. Deterministic: nodes are seeded near the final
 * "mandala" shape and the simulation runs a fixed tick count with no timer.
 */
export function computeForceLayout(graphData: GraphData): LayoutResult {
  const N = Math.max(graphData.graph.length, 1);

  const nodes: SimNode[] = [];
  const links: SimulationLinkDatum<SimNode>[] = [];
  const edges: LayoutEdge[] = [];

  const center: SimNode = {
    id: 'center',
    kind: 'center',
    w: CENTER_W,
    h: CENTER_H,
    color: CYAN,
    catIndex: -1,
    factIndex: -1,
    x: 0,
    y: 0,
    fx: 0,
    fy: 0,
  };
  nodes.push(center);

  graphData.graph.forEach((cat, i) => {
    const angle = (2 * Math.PI * i) / N - Math.PI / 2;
    const color = cat.color || CYAN;
    const catNode: SimNode = {
      id: `cat-${i}`,
      kind: 'category',
      w: CATEGORY_W,
      h: CATEGORY_H,
      color,
      catIndex: i,
      factIndex: -1,
      x: CATEGORY_ORBIT * Math.cos(angle),
      y: CATEGORY_ORBIT * Math.sin(angle),
    };
    nodes.push(catNode);
    links.push({ source: 'center', target: catNode.id });
    edges.push({
      id: `e-c-${i}`,
      sourceId: 'center',
      targetId: catNode.id,
      color,
      catIndex: i,
      factIndex: -1,
    });

    const M = cat.facts.length;
    cat.facts.forEach((fact, j) => {
      // Fan facts outward beyond their category, spread around its angle.
      const spread = M > 1 ? (j / (M - 1) - 0.5) * 0.9 : 0;
      const factAngle = angle + spread;
      const factR = CATEGORY_ORBIT + FACT_LINK_DIST + (j % 2) * 60;
      const factNode: SimNode = {
        id: `fact-${i}-${j}`,
        kind: 'fact',
        w: FACT_CARD_W,
        h: measureFactHeight(fact),
        color,
        catIndex: i,
        factIndex: j,
        x: factR * Math.cos(factAngle),
        y: factR * Math.sin(factAngle),
      };
      nodes.push(factNode);
      links.push({ source: catNode.id, target: factNode.id });
      edges.push({
        id: `e-f-${i}-${j}`,
        sourceId: catNode.id,
        targetId: factNode.id,
        color,
        catIndex: i,
        factIndex: j,
      });
    });
  });

  const sim = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
        .id(n => n.id)
        .distance(l => ((l.source as SimNode).kind === 'center' ? 300 : FACT_LINK_DIST))
        .strength(0.9),
    )
    .force(
      'charge',
      forceManyBody<SimNode>().strength(n =>
        n.kind === 'center' ? -900 : n.kind === 'category' ? -800 : -300,
      ),
    )
    .force(
      'orbit',
      forceRadial<SimNode>(CATEGORY_ORBIT, 0, 0).strength(n => (n.kind === 'category' ? 0.35 : 0)),
    )
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius(n => Math.hypot(n.w, n.h) / 2 + 14)
        .strength(0.8),
    )
    .force('rect', rectCollide(14, 2))
    .force('x', forceX<SimNode>(0).strength(0.02))
    .force('y', forceY<SimNode>(0).strength(0.02))
    .stop();

  for (let i = 0; i < SETTLE_TICKS; i++) sim.tick();

  const layoutNodes: LayoutNode[] = nodes.map(n => ({
    id: n.id,
    kind: n.kind,
    w: n.w,
    h: n.h,
    x: n.x ?? 0,
    y: n.y ?? 0,
    color: n.color,
    catIndex: n.catIndex,
    factIndex: n.factIndex,
  }));

  return {
    nodes: layoutNodes,
    byId: new Map(layoutNodes.map(n => [n.id, n])),
    edges,
    bbox: computeBBox(layoutNodes),
  };
}

/** Bounding box of one category and its facts (camera target for focus mode). */
export function categoryBBox(layout: LayoutResult, catIndex: number): BBox {
  const subtree = layout.nodes.filter(n => n.catIndex === catIndex);
  return computeBBox(subtree.length ? subtree : layout.nodes);
}
