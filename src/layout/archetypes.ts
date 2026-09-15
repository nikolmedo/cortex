import type { SimulationLinkDatum } from 'd3-force';
import type { SceneArchetype } from '../domain/Scene';
import type { SimNode } from './forceLayout';

export type SimLink = SimulationLinkDatum<SimNode>;

/** Everything a recipe needs to seed positions and tune forces. */
export interface RecipeContext {
  center: SimNode;
  spotlight: SimNode | null;
  categories: SimNode[];
  /** Leaves (fact or block nodes) per category, in item order. */
  leaves: SimNode[][];
  orbit: number;
  leafDist: number;
  padding: number;
  categoryW: number;
  /** Tallest category node. */
  categoryH: number;
  centerH: number;
  maxLeafW: number;
  maxLeafH: number;
  /** Mean leaf height; recipes that tile space use it so one tall block does not inflate the whole layout. */
  avgLeafH: number;
  /** Sum of every leaf width plus padding, for ring circumference budgets. */
  leafArc: number;
}

interface Recipe {
  linkDistance: (link: SimLink) => number;
  linkStrength: (link: SimLink) => number;
  charge: (node: SimNode) => number;
}

const TAU = 2 * Math.PI;

function linkKind(link: SimLink): 'trunk' | 'spotlight' | 'leaf' {
  const s = link.source as SimNode;
  const t = link.target as SimNode;
  if (s.kind !== 'center') return 'leaf';
  return t.kind === 'spotlight' ? 'spotlight' : 'trunk';
}

/** Seeds a node and sets its positional target with the given pull strength. */
function place(n: SimNode, x: number, y: number, strength: number): void {
  n.x = x;
  n.y = y;
  n.tx = x;
  n.ty = y;
  n.sx = strength;
  n.sy = strength;
}

/** Deterministic pseudo-random in [-1, 1) derived from an integer seed. */
function jitter(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** Spotlight directly below the center; collisions settle the exact gap. */
function spotlightBelowCenter(ctx: RecipeContext, strength: number): void {
  if (!ctx.spotlight) return;
  place(ctx.spotlight, 0, ctx.centerH / 2 + ctx.spotlight.h / 2 + ctx.padding * 2, strength);
}

/* ------------------------------------------------------------------------ */

function constellation(ctx: RecipeContext): Recipe {
  const N = Math.max(ctx.categories.length, 1);
  // With a spotlight hanging below the center, start half a step in so no category sits at 6 o'clock.
  const start = -Math.PI / 2 + (ctx.spotlight ? Math.PI / N : 0);
  spotlightBelowCenter(ctx, 0.4);

  ctx.categories.forEach((cat, i) => {
    const angle = start + (TAU * i) / N;
    place(cat, ctx.orbit * Math.cos(angle), ctx.orbit * Math.sin(angle), 0.02);
    cat.tr = ctx.orbit;
    cat.sr = 0.35;

    const leaves = ctx.leaves[i];
    const M = leaves.length;
    leaves.forEach((leaf, j) => {
      const spread = M > 1 ? (j / (M - 1) - 0.5) * 0.9 : 0;
      const a = angle + spread;
      const r = ctx.orbit + ctx.leafDist + (j % 2) * 60;
      place(leaf, r * Math.cos(a), r * Math.sin(a), 0.02);
    });
  });

  return {
    linkDistance: l => (linkKind(l) === 'leaf' ? ctx.leafDist : ctx.orbit),
    linkStrength: () => 0.9,
    charge: n => (n.kind === 'center' ? -900 : n.kind === 'category' ? -800 : -300),
  };
}

function orbital(ctx: RecipeContext): Recipe {
  const N = Math.max(ctx.categories.length, 1);
  const spotH = ctx.spotlight ? ctx.spotlight.h : 0;
  const innerClearance = ctx.centerH / 2 + spotH + ctx.padding * 3 + ctx.categoryH / 2;
  const R1 = Math.max(
    ctx.orbit,
    (N * (ctx.categoryW + ctx.padding * 2)) / TAU,
    ctx.spotlight ? innerClearance : 0,
  );
  const R2 = Math.max(R1 + ctx.categoryH / 2 + ctx.leafDist * 0.6 + ctx.maxLeafH / 2, (ctx.leafArc * 1.05) / TAU);
  spotlightBelowCenter(ctx, 0.6);

  ctx.categories.forEach((cat, i) => {
    const angle = -Math.PI / 2 + (TAU * i) / N;
    place(cat, R1 * Math.cos(angle), R1 * Math.sin(angle), 0);
    cat.tr = R1;
    cat.sr = 0.9;

    const leaves = ctx.leaves[i];
    const sector = TAU / N;
    leaves.forEach((leaf, j) => {
      const a = angle + ((j + 0.5) / leaves.length - 0.5) * sector * 0.9;
      place(leaf, R2 * Math.cos(a), R2 * Math.sin(a), 0);
      leaf.tr = R2;
      leaf.sr = 0.7;
    });
  });

  return {
    linkDistance: l => {
      const kind = linkKind(l);
      return kind === 'leaf' ? R2 - R1 : kind === 'trunk' ? R1 : ctx.centerH;
    },
    linkStrength: l => (linkKind(l) === 'leaf' ? 0.3 : 0.5),
    charge: n => (n.kind === 'center' ? -600 : n.kind === 'category' ? -400 : -200),
  };
}

function spine(ctx: RecipeContext): Recipe {
  const N = ctx.categories.length;
  const spacing = Math.max(ctx.maxLeafW, ctx.categoryW) + ctx.padding * 2;
  const gap = ctx.centerH / 2 + ctx.categoryH / 2 + ctx.padding * 2;
  const x0 = -((N - 1) / 2) * spacing;

  if (ctx.spotlight) place(ctx.spotlight, x0 - spacing, 0, 0.8);

  ctx.categories.forEach((cat, i) => {
    const x = x0 + i * spacing;
    const sign = i % 2 === 0 ? -1 : 1;
    place(cat, x, sign * gap, 0.9);

    let cursor = ctx.categoryH / 2 + ctx.leafDist * 0.5;
    ctx.leaves[i].forEach(leaf => {
      const y = sign * (gap + cursor + leaf.h / 2);
      place(leaf, x, y, 0.5);
      leaf.sx = 0.8;
      cursor += leaf.h + ctx.padding;
    });
  });

  return {
    linkDistance: l => (linkKind(l) === 'leaf' ? ctx.leafDist * 0.5 : spacing),
    linkStrength: l => (linkKind(l) === 'leaf' ? 0.2 : 0.05),
    charge: n => (n.kind === 'center' ? -300 : n.kind === 'category' ? -200 : -100),
  };
}

function mosaic(ctx: RecipeContext): Recipe {
  const N = ctx.categories.length;
  const cellCount = N + 1 + (ctx.spotlight ? 1 : 0);
  const cols = Math.ceil(Math.sqrt(cellCount));
  const rows = Math.ceil(cellCount / cols);
  const pitchX = 2 * ctx.maxLeafW + ctx.categoryW + ctx.padding * 3;
  const pitchY = 2.4 * ctx.avgLeafH + ctx.categoryH + ctx.padding * 3;
  const centerCol = Math.floor((cols - 1) / 2);
  const centerRow = Math.floor((rows - 1) / 2);
  const centerCell = centerRow * cols + centerCol;

  const cellOf = (index: number) => {
    const cell = index >= centerCell ? index + 1 : index;
    return {
      x: (cell % cols - centerCol) * pitchX,
      y: (Math.floor(cell / cols) - centerRow) * pitchY,
    };
  };

  if (ctx.spotlight) {
    const c = cellOf(N);
    place(ctx.spotlight, c.x + jitter(101) * 0.1 * pitchX, c.y + jitter(103) * 0.1 * pitchY, 0.5);
  }

  const ringR = ctx.categoryW / 2 + ctx.maxLeafW / 2 + ctx.padding;
  ctx.categories.forEach((cat, i) => {
    const c = cellOf(i);
    const cx = c.x + jitter(i) * 0.15 * pitchX;
    const cy = c.y + jitter(i + 7) * 0.15 * pitchY;
    place(cat, cx, cy, 0.5);

    const leaves = ctx.leaves[i];
    const start = -Math.PI / 2 + jitter(i + 13) * 0.6;
    leaves.forEach((leaf, j) => {
      const a = start + (TAU * j) / leaves.length;
      place(leaf, cx + ringR * Math.cos(a), cy + ringR * 0.8 * Math.sin(a), 0.25);
    });
  });

  return {
    linkDistance: l => (linkKind(l) === 'leaf' ? ringR * 0.9 : pitchX * 0.7),
    linkStrength: l => (linkKind(l) === 'leaf' ? 0.5 : 0.05),
    charge: n => (n.kind === 'center' ? -500 : n.kind === 'category' ? -300 : -120),
  };
}

function spiral(ctx: RecipeContext): Recipe {
  const lane1 = ctx.categoryH / 2 + ctx.avgLeafH / 2 + ctx.padding;
  const lane2 = lane1 + ctx.avgLeafH + ctx.padding;
  const turnPitch = lane2 + ctx.avgLeafH / 2 + ctx.categoryH / 2 + ctx.padding * 2;
  const b = turnPitch / TAU;
  const step = 1.9;
  const r0 = Math.max(ctx.orbit * 0.7, ctx.centerH / 2 + ctx.categoryH / 2 + ctx.padding * 2);
  const theta0 = -Math.PI / 2;

  if (ctx.spotlight) {
    const a = theta0 - step * 0.8;
    place(ctx.spotlight, r0 * Math.cos(a), r0 * Math.sin(a), 0.5);
  }

  ctx.categories.forEach((cat, i) => {
    const t = i * step;
    const r = r0 + b * t;
    const a = theta0 + t;
    place(cat, r * Math.cos(a), r * Math.sin(a), 0.5);

    ctx.leaves[i].forEach((leaf, j) => {
      const lr = r + (j % 2 === 0 ? lane1 : lane2);
      const la = a + ((Math.floor(j / 2) + 0.5) * (leaf.w + ctx.padding)) / lr;
      place(leaf, lr * Math.cos(la), lr * Math.sin(la), 0.3);
    });
  });

  return {
    linkDistance: l => (linkKind(l) === 'leaf' ? lane1 : r0),
    linkStrength: l => (linkKind(l) === 'leaf' ? 0.3 : 0.1),
    charge: n => (n.kind === 'center' ? -600 : n.kind === 'category' ? -300 : -150),
  };
}

export const RECIPES: Record<SceneArchetype, (ctx: RecipeContext) => Recipe> = {
  constellation,
  orbital,
  spine,
  mosaic,
  spiral,
};
