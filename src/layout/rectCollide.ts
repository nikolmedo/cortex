import type { Force } from 'd3-force';
import type { SimNode } from './forceLayout';

/**
 * One axis-aligned rectangle separation pass. Returns the number of pairs
 * that were overlapping before the pass. O(n²) is fine at this scale (≤ 60 nodes).
 */
export function separateRects(nodes: SimNode[], padding: number): number {
  let overlapping = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x! - a.x!;
      const dy = b.y! - a.y!;
      const overlapX = (a.w + b.w) / 2 + padding - Math.abs(dx);
      const overlapY = (a.h + b.h) / 2 + padding - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      overlapping++;

      const aFixed = a.fx != null;
      const bFixed = b.fx != null;
      if (aFixed && bFixed) continue;

      // Separate along the axis of least overlap.
      if (overlapX < overlapY) {
        const push = overlapX * (dx < 0 ? -1 : 1);
        if (aFixed) b.x! += push;
        else if (bFixed) a.x! -= push;
        else {
          a.x! -= push / 2;
          b.x! += push / 2;
        }
      } else {
        const push = overlapY * (dy < 0 ? -1 : 1);
        if (aFixed) b.y! += push;
        else if (bFixed) a.y! -= push;
        else {
          a.y! -= push / 2;
          b.y! += push / 2;
        }
      }
    }
  }
  return overlapping;
}

/**
 * Rectangle-aware separation force. d3's forceCollide is circle-based; this
 * resolves the residual rectangle overlaps the circle approximation misses.
 */
export function rectCollide(padding = 12, iterations = 2): Force<SimNode, undefined> {
  let nodes: SimNode[] = [];

  const force: Force<SimNode, undefined> = () => {
    for (let iter = 0; iter < iterations; iter++) separateRects(nodes, padding);
  };

  force.initialize = (n: SimNode[]) => {
    nodes = n;
  };

  return force;
}
