/*
 * Dev sanity check for the force layout: builds synthetic scenes at three
 * sizes (with composite blocks and a spotlight node), runs every archetype
 * at every density, and asserts that no node rectangles intersect.
 * Run with: npx tsx scripts/layout-check.mts
 *
 * There is no DOM here: node sizes are stubbed from the role widths and a
 * monospace height approximation, which is enough to exercise the solver
 * with realistic rectangles.
 */

import type { FactKind, Scene, SceneCategory, SceneItem } from '../src/domain/Scene.ts';
import { SCENE_ARCHETYPES, SCENE_DENSITIES } from '../src/domain/Scene.ts';
import { computeForceLayout } from '../src/layout/forceLayout.ts';
import { CENTER_H, ROLE_W } from '../src/layout/measure.ts';
import { buildGraphSpec } from '../src/layout/sceneNodes.ts';
import { categoryItems, isCompositeKind } from '../src/presentation/components/facts/model.ts';
import type { NodeSize, NodeSpec } from '../src/layout/types.ts';

const KIND_CYCLE: FactKind[] = ['list', 'timeline', 'stats', 'comparison', 'quote', 'ranking', 'progress', 'keyvalue', 'tags'];

function synthetic(categories: number, items: number, longText: boolean): Scene {
  const text = (i: number, j: number) =>
    longText
      ? `Category ${i} item ${j}: a deliberately long research note that wraps onto several lines to stress the rectangle collision solver`
      : `Cat ${i} item ${j}`;
  const graph: SceneCategory[] = Array.from({ length: categories }, (_, i) => {
    const kind = KIND_CYCLE[i % KIND_CYCLE.length];
    const list: SceneItem[] = Array.from({ length: items }, (_, j) => ({
      label: text(i, j),
      value: kind === 'stats' || kind === 'timeline' ? `${1990 + j}` : undefined,
      detail: longText ? 'Supporting detail line' : undefined,
      weight: 20 + j * 12,
      side: j % 2 === 0 ? 'a' : 'b',
    }));
    return {
      category: `CATEGORY ${i + 1}`,
      color: '#00D4FF',
      image_query: 'test',
      kind,
      headline: longText ? 'A short headline under the label' : undefined,
      facts: list.map(it => it.label),
      items: list,
    };
  });
  return {
    version: 2,
    type: 'concept',
    title: 'Synthetic Stress Entity',
    subtitle: 'Layout check',
    summary: '',
    image_url: '',
    image_query: '',
    meta: {},
    presentation: {
      archetype: 'constellation',
      mood: 'calm',
      motif: 'hex',
      density: 'balanced',
      palette: { primary: '#00D4FF', secondary: '#7B2FBE', accent: '#FF3C6E' },
    },
    spotlight: { kind: 'stat', label: 'Headline metric', value: '42%', source: 'Synthetic' },
    graph,
  };
}

/** Monospace approximation: 12.5px Space Mono is ~7.5px per glyph, 19.4px per line. */
function textHeight(text: string, width: number, lineH = 19.4): number {
  const perLine = Math.max(1, Math.floor(width / 7.5));
  return Math.ceil(text.length / perLine) * lineH;
}

function stubSize(spec: NodeSpec, scene: Scene): NodeSize {
  const w = ROLE_W[spec.kind];
  const cat = scene.graph[spec.catIndex];
  switch (spec.kind) {
    case 'center':
      return { w, h: CENTER_H };
    case 'spotlight':
      return { w, h: 110 };
    case 'category':
      return { w, h: cat?.headline ? 178 : 152 };
    case 'fact': {
      const item = categoryItems(cat)[spec.factIndex];
      const body = textHeight(item.label, w - 26) + (item.detail ? textHeight(item.detail, w - 26, 16) : 0);
      return { w, h: Math.ceil(body + 40) };
    }
    case 'block': {
      const items = categoryItems(cat);
      const rowH = items.reduce((h, it) => h + textHeight(it.label, w - 70) + 14, 0);
      return { w, h: Math.ceil(rowH + 48) };
    }
  }
}

function stubSizes(scene: Scene): Map<string, NodeSize> {
  return new Map(buildGraphSpec(scene).nodes.map(n => [n.id, stubSize(n, scene)]));
}

const DATASETS = [
  [4, 2, false],
  [6, 4, true],
  [8, 6, true],
] as const;

let failures = 0;

for (const [cats, items, long] of DATASETS) {
  const scene = synthetic(cats, items, long);
  const sizes = stubSizes(scene);
  const composite = scene.graph.filter(c => isCompositeKind(c.kind)).length;

  for (const archetype of SCENE_ARCHETYPES) {
    for (const density of SCENE_DENSITIES) {
      const layout = computeForceLayout(scene, sizes, { archetype, density });
      let overlaps = 0;
      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          const a = layout.nodes[i];
          const b = layout.nodes[j];
          const ox = (a.w + b.w) / 2 - Math.abs(b.x - a.x);
          const oy = (a.h + b.h) / 2 - Math.abs(b.y - a.y);
          if (ox > 0.5 && oy > 0.5) {
            overlaps++;
            console.error(`  OVERLAP ${a.id} x ${b.id} (${ox.toFixed(1)}px x ${oy.toFixed(1)}px)`);
          }
        }
      }
      const w = Math.round(layout.bbox.maxX - layout.bbox.minX);
      const h = Math.round(layout.bbox.maxY - layout.bbox.minY);
      const status = overlaps === 0 ? 'OK' : `FAIL (${overlaps} overlaps)`;
      console.log(
        `${archetype.padEnd(13)} ${density.padEnd(8)} ${cats}x${items}${long ? ' long' : ''}` +
          ` (${composite} blocks): ${layout.nodes.length} nodes, bbox ${w}x${h} - ${status}`,
      );
      if (overlaps > 0) failures++;
    }
  }
}

process.exit(failures ? 1 : 0);
