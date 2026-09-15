import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
import type { Scene, SceneArchetype, SceneDensity } from '../domain/Scene';
import { RECIPES, type RecipeContext, type SimLink } from './archetypes';
import { ROLE_W, sizeOf } from './measure';
import { rectCollide, separateRects } from './rectCollide';
import { DENSITY_METRICS } from './sceneMetrics';
import { buildGraphSpec } from './sceneNodes';
import type { BBox, LayoutNode, LayoutResult, NodeSizes, NodeSpec } from './types';

export interface SimNode extends SimulationNodeDatum, NodeSpec {
  w: number;
  h: number;
  /** Positional target and pull strength (forceX/forceY). */
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  /** Ring target and pull strength (forceRadial around the origin). */
  tr: number;
  sr: number;
}

interface LayoutOptions {
  archetype?: SceneArchetype;
  density?: SceneDensity;
}

const BASE_ORBIT = 300;
const BASE_LEAF_DIST = 170;
const SETTLE_TICKS = 320;
const RESOLVE_PASSES = 200;

function computeBBox(nodes: LayoutNode[]): BBox {
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
 * Settles the scene graph synchronously and deterministically: the archetype
 * seeds every node near its final shape, a fixed tick count runs with no
 * timer, and a final rectangle pass guarantees zero overlap regardless of
 * the recipe. Sizes come from offscreen measurement (or stubs in scripts).
 */
export function computeForceLayout(scene: Scene, sizes: NodeSizes, options: LayoutOptions = {}): LayoutResult {
  const archetype = options.archetype ?? scene.presentation.archetype;
  const density = DENSITY_METRICS[options.density ?? scene.presentation.density];
  const spec = buildGraphSpec(scene);

  const nodes: SimNode[] = spec.nodes.map(n => ({
    ...n,
    ...sizeOf(sizes, n),
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    sx: 0,
    sy: 0,
    tr: 0,
    sr: 0,
  }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const center = byId.get('center')!;
  center.fx = 0;
  center.fy = 0;

  const categories = nodes.filter(n => n.kind === 'category');
  const leaves = categories.map(cat =>
    nodes.filter(n => (n.kind === 'fact' || n.kind === 'block') && n.catIndex === cat.catIndex),
  );
  const allLeaves = leaves.flat();

  const ctx: RecipeContext = {
    center,
    spotlight: byId.get('spotlight') ?? null,
    categories,
    leaves,
    orbit: BASE_ORBIT * density.orbit,
    leafDist: BASE_LEAF_DIST * density.link,
    padding: density.padding,
    categoryW: ROLE_W.category,
    categoryH: Math.max(0, ...categories.map(n => n.h)),
    centerH: center.h,
    maxLeafW: Math.max(ROLE_W.fact, ...allLeaves.map(n => n.w)),
    maxLeafH: Math.max(0, ...allLeaves.map(n => n.h)),
    avgLeafH: allLeaves.length ? allLeaves.reduce((s, n) => s + n.h, 0) / allLeaves.length : 0,
    leafArc: allLeaves.reduce((s, n) => s + n.w + density.padding * 2, 0),
  };
  const recipe = RECIPES[archetype](ctx);

  const links: SimLink[] = spec.edges.map(e => ({ source: e.sourceId, target: e.targetId }));

  const sim = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id(n => n.id)
        .distance(recipe.linkDistance)
        .strength(recipe.linkStrength),
    )
    .force('charge', forceManyBody<SimNode>().strength(recipe.charge))
    .force('ring', forceRadial<SimNode>(n => n.tr, 0, 0).strength(n => n.sr))
    .force('x', forceX<SimNode>(n => n.tx).strength(n => n.sx))
    .force('y', forceY<SimNode>(n => n.ty).strength(n => n.sy))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius(n => Math.hypot(n.w, n.h) / 2 + density.padding)
        .strength(0.7),
    )
    .force('rect', rectCollide(density.padding, 2))
    .stop();

  for (let i = 0; i < SETTLE_TICKS; i++) sim.tick();
  for (let i = 0; i < RESOLVE_PASSES && separateRects(nodes, density.padding) > 0; i++);

  const layoutNodes: LayoutNode[] = nodes.map(n => ({
    id: n.id,
    kind: n.kind,
    color: n.color,
    catIndex: n.catIndex,
    factIndex: n.factIndex,
    w: n.w,
    h: n.h,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));

  return {
    archetype,
    nodes: layoutNodes,
    byId: new Map(layoutNodes.map(n => [n.id, n])),
    edges: spec.edges,
    bbox: computeBBox(layoutNodes),
    padding: density.padding,
  };
}

/** Bounding box of one category and its leaves (camera target for focus mode). */
export function categoryBBox(layout: LayoutResult, catIndex: number): BBox {
  const subtree = layout.nodes.filter(n => n.catIndex === catIndex);
  return computeBBox(subtree.length ? subtree : layout.nodes);
}
