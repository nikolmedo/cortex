import { describe, expect, it } from 'vitest';
import type { FactKind, ModuleSize, SceneModule } from '../../../domain/Scene';
import {
  balancedSpans, chartReadsAsLine, columnsOf, fillRows, partitionModules, patternSeed, type IndexedModule,
} from './items';

function entry(index: number, kind: FactKind, size?: ModuleSize, rows = 3): IndexedModule {
  const module: SceneModule = {
    category: `M${index}`,
    color: '#7FD8FF',
    image_query: '',
    kind,
    facts: Array.from({ length: rows }, (_, i) => `f${i}`),
  };
  if (size) module.size = size;
  return { module, index };
}

describe('balancedSpans', () => {
  it('pairs compact cards of similar height and widens a lone one when nothing is sized', () => {
    const entries = [entry(0, 'stats'), entry(1, 'keyvalue'), entry(2, 'list'), entry(3, 'chart')];
    expect(balancedSpans('focus', entries, 'wide')).toEqual(['compact', 'compact', 'wide', 'wide']);
  });

  it('widens a compact card whose neighbour is much taller', () => {
    const entries = [entry(0, 'tags', undefined, 2), entry(1, 'steps', undefined, 8)];
    expect(balancedSpans('focus', entries, 'wide')).toEqual(['wide', 'wide']);
  });

  it('never adjusts a sized module and lets an automatic card sit beside it', () => {
    const entries = [entry(0, 'tags', 'third'), entry(1, 'steps', undefined, 8), entry(2, 'chart', 'half')];
    const spans = balancedSpans('focus', entries, 'wide');
    expect(spans[0]).toBe('compact');
    expect(spans[2]).toBe('compact');
  });

  it('widens an automatic card that would not fit beside a sized one', () => {
    const entries = [entry(0, 'stats', 'two-thirds'), entry(1, 'list')];
    // 8 + 6 columns overflow the row, so the list would sit alone in the next one.
    expect(balancedSpans('focus', entries, 'wide')).toEqual(['compact', 'wide']);
  });

  it('keeps an automatic card compact when it fills the rest of a sized row', () => {
    const entries = [entry(0, 'stats', 'two-thirds'), entry(1, 'list')];
    // Mosaic tiles take 4 columns, so 8 + 4 fills the row exactly.
    expect(balancedSpans('mosaic', entries, 'wide')).toEqual(['compact', 'compact']);
  });

  it('does not count a sized row that is already full as room', () => {
    const entries = [entry(0, 'timeline', 'two-thirds'), entry(1, 'list', 'third'), entry(2, 'stats')];
    expect(balancedSpans('focus', entries, 'wide')[2]).toBe('wide');
  });

  it('reports a full-size module as wide', () => {
    expect(balancedSpans('mosaic', [entry(0, 'tags', 'full')], 'wide')).toEqual(['wide']);
  });

  it('keeps the two sides of a split comparison as a pair whatever their size', () => {
    const entries = [entry(0, 'proscons', 'full'), entry(1, 'proscons')];
    expect(balancedSpans('split', entries, 'wide')).toEqual(['pair', 'pair']);
  });
});

describe('fillRows', () => {
  const fill = (layout: Parameters<typeof balancedSpans>[0], entries: IndexedModule[], keepTail = false) =>
    fillRows(layout, entries, balancedSpans(layout, entries, 'wide'), 'wide', keepTail);

  it('widens the lone side of a split comparison to the full row', () => {
    // The postgres fixture: full comparison, one pros/cons card, full keyvalue.
    const entries = [entry(0, 'comparison', 'full'), entry(1, 'proscons'), entry(2, 'keyvalue', 'full')];
    expect(fill('split', entries)).toEqual([undefined, 12, undefined]);
  });

  it('stretches a sized orphan in the final row', () => {
    const entries = [entry(0, 'timeline', 'full'), entry(1, 'quote', 'half')];
    expect(fill('focus', entries)).toEqual([undefined, 12]);
  });

  it('closes a mid-row hole when the next card does not fit', () => {
    // 4 + 4 leaves 4 columns, and the half-width card after them needs 6.
    const entries = [entry(0, 'list', 'third'), entry(1, 'tags', 'third'), entry(2, 'stats', 'half'), entry(3, 'quote', 'half')];
    expect(fill('focus', entries)).toEqual([undefined, 8, undefined, undefined]);
  });

  it('prefers an automatic card over a sized one when the row has both', () => {
    const entries = [entry(0, 'stats'), entry(1, 'list', 'quarter'), entry(2, 'chart', 'full')];
    const spans = balancedSpans('mosaic', entries, 'wide');
    // Mosaic: an automatic compact tile is 4 columns, the quarter is 3.
    expect(fillRows('mosaic', entries, spans, 'wide')).toEqual([9, undefined, undefined]);
  });

  it('leaves rows that already tile untouched', () => {
    const entries = [entry(0, 'timeline', 'two-thirds'), entry(1, 'list', 'third'), entry(2, 'stats', 'half'), entry(3, 'quote', 'half')];
    expect(fill('focus', entries)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('keeps the trailing row open while modules are still arriving', () => {
    const entries = [entry(0, 'timeline', 'full'), entry(1, 'quote', 'half')];
    expect(fill('focus', entries, true)).toEqual([undefined, undefined]);
  });

  it('fills to the half/full grid a tablet has', () => {
    const entries = [entry(0, 'quote', 'third'), entry(1, 'chart', 'full')];
    const spans = balancedSpans('focus', entries, 'narrow');
    expect(fillRows('focus', entries, spans, 'narrow')).toEqual([12, undefined]);
  });

  it('is deterministic', () => {
    const entries = [entry(0, 'list', 'third'), entry(1, 'stats'), entry(2, 'quote', 'half')];
    expect(fill('focus', entries)).toEqual(fill('focus', entries));
  });
});

describe('partitionModules', () => {
  it('keeps a sized rail kind in the main row unless it asks for the rail', () => {
    const stats = entry(0, 'stats', 'half').module;
    const railed = { ...entry(1, 'keyvalue', 'third').module, slot: 'rail' as const };
    const plain = entry(2, 'tags').module;
    for (const honourSlot of [false, true]) {
      const { main, rail } = partitionModules('focus', [stats, railed, plain], honourSlot);
      expect(main.map(e => e.index)).toContain(0);
      expect(rail.map(e => e.index)).toContain(2);
    }
    expect(partitionModules('focus', [stats, railed, plain], true).rail.map(e => e.index)).toContain(1);
  });
});

describe('patternSeed', () => {
  const scene = [entry(0, 'stats'), entry(1, 'list'), entry(2, 'stats')].map(e => e.module);

  it("keeps a module's seed when later modules are appended", () => {
    const before = scene.slice(0, 2);
    const after = [...before, scene[2], entry(3, 'chart').module];
    expect(before.map(m => patternSeed(before, m))).toEqual(before.map(m => patternSeed(after, m)));
  });

  it('does not depend on where the card lands or on its streaming title', () => {
    const seed = patternSeed(scene, scene[0]);
    const { main, rail } = partitionModules('focus', scene);
    expect(rail.map(e => e.module)).toContain(scene[0]);
    expect(main.length).toBeGreaterThan(0);
    const retitled = { ...scene[0], category: 'Longer streamed title' };
    expect(patternSeed([retitled, ...scene.slice(1)], retitled)).toBe(seed);
  });

  it('tells same-kind modules at different places apart', () => {
    expect(patternSeed(scene, scene[0])).not.toBe(patternSeed(scene, scene[2]));
  });
});

describe('chartReadsAsLine', () => {
  const points = (labels: string[]) => labels.map((label, i) => ({ label, weight: i * 10 }));

  it('reads five or more short-labelled weighted points as a line', () => {
    expect(chartReadsAsLine(points(['2019', '2020', '2021', '2022', '2023']))).toBe(true);
  });

  it('reads few points, long labels or missing weights as bars', () => {
    expect(chartReadsAsLine(points(['2021', '2022', '2023']))).toBe(false);
    expect(chartReadsAsLine(points(['North America', 'Europe', 'Asia', 'Africa', 'Oceania']))).toBe(false);
    expect(chartReadsAsLine(['a', 'b', 'c', 'd', 'e'].map(label => ({ label })))).toBe(false);
  });
});

describe('columnsOf', () => {
  const sized = (size: ModuleSize) => entry(0, 'list', size).module;

  it('gives a sized card its own width on desktop and half or full on tablet', () => {
    const sizes: ModuleSize[] = ['quarter', 'third', 'half', 'two-thirds', 'full'];
    expect(sizes.map(s => columnsOf('focus', sized(s), 'compact', 'wide'))).toEqual([3, 4, 6, 8, 12]);
    expect(sizes.map(s => columnsOf('focus', sized(s), 'compact', 'narrow'))).toEqual([6, 6, 6, 12, 12]);
  });

  it("follows each layout's span defaults for an unsized card", () => {
    const plain = entry(0, 'list').module;
    expect(columnsOf('focus', plain, 'compact', 'wide')).toBe(6);
    expect(columnsOf('focus', plain, 'wide', 'wide')).toBe(12);
    expect(columnsOf('mosaic', plain, 'compact', 'wide')).toBe(4);
    expect(columnsOf('mosaic', plain, 'wide', 'wide')).toBe(8);
    expect(columnsOf('split', plain, 'compact', 'wide')).toBe(12);
    expect(columnsOf('split', entry(0, 'proscons').module, 'pair', 'wide')).toBe(6);
    expect(columnsOf('mosaic', plain, 'compact', 'narrow')).toBe(6);
  });
});
