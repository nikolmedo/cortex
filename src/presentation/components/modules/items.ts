import type { FactKind, SceneItem, SceneLayout, SceneModule } from '../../../domain/Scene';

/** Structured items when present, otherwise the plain facts as label-only items. */
export function moduleItems(module: SceneModule): SceneItem[] {
  if (module.items && module.items.length > 0) return module.items;
  return module.facts.map(label => ({ label }));
}

/**
 * wide: needs the full row of a composition grid.
 * compact: reads well in a half or third of the row.
 * pair: one side of a two-up comparison (split layout only).
 */
export type ModuleSpan = 'wide' | 'compact' | 'pair';

const COMPACT_KINDS: ReadonlySet<FactKind> = new Set<FactKind>([
  'keyvalue', 'stats', 'tags', 'ranking', 'progress', 'quote', 'list',
]);

/** On a full-width desktop row only these still need the whole row to read well. */
const DESKTOP_WIDE_KINDS: ReadonlySet<FactKind> = new Set<FactKind>(['code', 'chart', 'prose', 'comparison']);

export type ModuleWidth = 'narrow' | 'wide';

export function moduleSpan(layout: SceneLayout, kind: FactKind, width: ModuleWidth = 'narrow'): ModuleSpan {
  if (layout === 'split' && kind === 'proscons') return 'pair';
  if (width === 'wide') return DESKTOP_WIDE_KINDS.has(kind) ? 'wide' : 'compact';
  return COMPACT_KINDS.has(kind) ? 'compact' : 'wide';
}

/** Kinds that sit in the side rail next to the reading column, per layout. */
const RAIL_KINDS: Record<SceneLayout, ReadonlySet<FactKind>> = {
  focus: new Set<FactKind>(['keyvalue', 'stats', 'tags', 'ranking', 'progress']),
  dossier: new Set<FactKind>(['keyvalue', 'stats', 'tags', 'ranking', 'progress']),
  sequence: new Set<FactKind>(['keyvalue', 'stats', 'tags', 'ranking', 'progress', 'list', 'quote', 'proscons', 'comparison', 'chart']),
  split: new Set<FactKind>(),
  mosaic: new Set<FactKind>(),
};

export interface IndexedModule {
  module: SceneModule;
  /** Position in scene.modules (reading order and stagger order). */
  index: number;
}

/** Two cards share a row only when neither would tower over the other. */
const PAIR_TOLERANCE_PX = 180;

/**
 * Spans for a two-up grid in reading order. A compact card that would sit alone
 * in its row, or next to a card of a very different height, takes the full width
 * instead: a lone tall neighbour leaves a column of dead space beside it.
 */
export function balancedSpans(layout: SceneLayout, entries: IndexedModule[], width: ModuleWidth = 'narrow'): ModuleSpan[] {
  const spans = entries.map(({ module }) => moduleSpan(layout, module.kind, width));
  let i = 0;
  while (i < spans.length) {
    const pairs = i + 1 < spans.length
      && spans[i] !== 'wide'
      && spans[i + 1] !== 'wide'
      && Math.abs(estimateHeight(entries[i].module) - estimateHeight(entries[i + 1].module)) <= PAIR_TOLERANCE_PX;
    if (pairs) {
      i += 2;
    } else {
      if (spans[i] === 'compact') spans[i] = 'wide';
      i += 1;
    }
  }
  return spans;
}

export function partitionModules(layout: SceneLayout, modules: SceneModule[]): { main: IndexedModule[]; rail: IndexedModule[] } {
  const main: IndexedModule[] = [];
  const rail: IndexedModule[] = [];
  modules.forEach((module, index) => {
    (RAIL_KINDS[layout].has(module.kind) ? rail : main).push({ module, index });
  });
  return { main, rail };
}

/** Rendered height of one item row, per kind, in px. */
const ROW_PX: Partial<Record<FactKind, number>> = {
  steps: 86,
  proscons: 86,
  comparison: 78,
  formula: 110,
  quote: 90,
  timeline: 64,
  stats: 62,
  ranking: 56,
  progress: 56,
  tags: 38,
};

/** Rough rendered height of a card, in px. Only ever used to compare cards with each other. */
export function estimateHeight(module: SceneModule): number {
  const base = 92 + (module.headline ? 26 : 0);
  if (module.kind === 'code' || module.kind === 'prose') return base + Math.ceil((module.body?.length ?? 0) / 55) * 22;
  if (module.kind === 'chart') return base + 200;
  const rows = module.items?.length ?? module.facts.length;
  return base + rows * (ROW_PX[module.kind] ?? 48);
}

/**
 * Keeps the side rail from outrunning the column beside it: rail modules that
 * no longer fit in `budgetPx` move back into the main flow, in reading order,
 * so no layout ends with a tall empty gutter.
 */
export function capRail(
  main: IndexedModule[],
  rail: IndexedModule[],
  budgetPx: number,
): { main: IndexedModule[]; rail: IndexedModule[] } {
  const kept: IndexedModule[] = [];
  const moved: IndexedModule[] = [];
  let used = 0;
  for (const entry of rail) {
    const height = estimateHeight(entry.module);
    if (used + height <= budgetPx) {
      kept.push(entry);
      used += height;
    } else {
      moved.push(entry);
    }
  }
  if (moved.length === 0) return { main, rail };
  return { main: [...main, ...moved].sort((a, b) => a.index - b.index), rail: kept };
}
