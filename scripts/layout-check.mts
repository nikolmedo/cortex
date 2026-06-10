/*
 * Dev sanity check for the force layout: builds synthetic datasets at both
 * extremes (4 categories × 2 facts, 8 × 5 with long texts) and asserts that
 * no node rectangles intersect. Run with: npx tsx scripts/layout-check.mts
 *
 * The DOM canvas is stubbed with a monospace width approximation — good
 * enough to exercise the collision solver with realistic rectangle sizes.
 */

// Stub the canvas measurement before importing the layout module.
(globalThis as Record<string, unknown>).document = {
  createElement: () => ({
    getContext: () => ({
      font: '',
      measureText: (text: string) => ({ width: text.length * 7.51 }),
    }),
  }),
  fonts: { ready: Promise.resolve() },
};

const { computeForceLayout } = await import('../src/layout/forceLayout.ts');
import type { GraphData } from '../src/domain/GraphData.ts';

function synthetic(categories: number, facts: number, longFacts: boolean): GraphData {
  const factText = (i: number, j: number) =>
    longFacts
      ? `Category ${i} fact ${j}: a deliberately long research note that wraps onto several lines to stress the rectangle collision solver`
      : `Cat ${i} fact ${j}`;
  return {
    type: 'concept',
    title: 'Synthetic Stress Entity',
    subtitle: 'Layout check',
    summary: '',
    graph: Array.from({ length: categories }, (_, i) => ({
      category: `CATEGORY ${i + 1}`,
      color: '#00D4FF',
      image_query: 'test',
      facts: Array.from({ length: facts }, (_, j) => factText(i, j)),
    })),
  };
}

let failures = 0;

for (const [cats, facts, long] of [
  [4, 2, false],
  [8, 5, true],
  [6, 4, true],
] as const) {
  const layout = computeForceLayout(synthetic(cats, facts, long));
  let overlaps = 0;
  for (let i = 0; i < layout.nodes.length; i++) {
    for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      const ox = (a.w + b.w) / 2 - Math.abs(b.x - a.x);
      const oy = (a.h + b.h) / 2 - Math.abs(b.y - a.y);
      if (ox > 0.5 && oy > 0.5) {
        overlaps++;
        console.error(`  OVERLAP ${a.id} × ${b.id} (${ox.toFixed(1)}px × ${oy.toFixed(1)}px)`);
      }
    }
  }
  const w = Math.round(layout.bbox.maxX - layout.bbox.minX);
  const h = Math.round(layout.bbox.maxY - layout.bbox.minY);
  const status = overlaps === 0 ? 'OK' : `FAIL (${overlaps} overlaps)`;
  console.log(`${cats}x${facts}${long ? ' long' : ''}: ${layout.nodes.length} nodes, bbox ${w}x${h} — ${status}`);
  if (overlaps > 0) failures++;
}

process.exit(failures ? 1 : 0);
