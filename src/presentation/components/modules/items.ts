import type {
  FactKind, ModuleReveal, ModuleSize, ModuleSpanHint, SceneItem, SceneLayout, SceneModule,
} from '../../../domain/Scene';

/** Structured items when present, otherwise the plain facts as label-only items. */
export function moduleItems(module: SceneModule): SceneItem[] {
  if (module.items && module.items.length > 0) return module.items;
  return module.facts.map(label => ({ label }));
}

/**
 * Whether a module has anything to draw at all. Items come first, facts are the
 * fallback every renderer already reads through `moduleItems`, and `body` covers
 * the two kinds that carry their content as text. A module with none of the
 * three is a header over an empty box, so the composition drops it instead.
 */
export function hasContent(module: SceneModule): boolean {
  return moduleItems(module).length > 0 || Boolean(module.body);
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

/**
 * `hint` is the model's `span` directive. It is read on a full-width desktop row
 * only: a narrow screen has one column to give, so a directive there means
 * nothing. It may widen a card, never squeeze one — a kind that needs the whole
 * row to be legible keeps it — so `compact` states an intent rather than forcing
 * a width, and the balancing pass below still has the last word either way.
 */
export function moduleSpan(
  layout: SceneLayout,
  kind: FactKind,
  width: ModuleWidth = 'narrow',
  hint?: ModuleSpanHint,
): ModuleSpan {
  if (layout === 'split' && kind === 'proscons') return 'pair';
  if (width === 'wide') {
    const natural = DESKTOP_WIDE_KINDS.has(kind) ? 'wide' : 'compact';
    return hint === 'wide' ? 'wide' : natural;
  }
  return COMPACT_KINDS.has(kind) ? 'compact' : 'wide';
}

/** Entrance a kind takes when the model does not ask for one. */
const KIND_REVEAL: Partial<Record<FactKind, ModuleReveal>> = {
  chart: 'draw',
  timeline: 'draw',
  steps: 'draw',
  stats: 'count',
};

/**
 * The module's `reveal` directive, or the default its kind earns. `undefined`
 * means "no opinion", which leaves the layout's own entrance family in place.
 */
export function moduleReveal(module: SceneModule): ModuleReveal | undefined {
  return module.reveal ?? KIND_REVEAL[module.kind];
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

/** Columns of the 12-column module row a `size` takes on a full-width desktop row. */
export const SIZE_COLUMNS: Record<ModuleSize, number> = {
  quarter: 3,
  third: 4,
  half: 6,
  'two-thirds': 8,
  full: 12,
};

/**
 * The span a sized module reports to the balancing pass. `size` is the finer
 * directive; its width reaches the grid as the card's column count.
 */
function sizedSpan(layout: SceneLayout, module: SceneModule, width: ModuleWidth): ModuleSpan {
  if (layout === 'split' && module.kind === 'proscons') return 'pair';
  return sizedColumns(module.size!, width) === 12 ? 'wide' : 'compact';
}

/** Tablet has two columns to give, so a size there only picks half or full. */
function sizedColumns(size: ModuleSize, width: ModuleWidth): number {
  const columns = SIZE_COLUMNS[size];
  if (width === 'wide') return columns;
  return columns > 6 ? 12 : 6;
}

/**
 * Columns a card takes on the 12-column row. The single source of card widths:
 * Composition passes the result down as `--cols`, and the stylesheet only spans it.
 */
export function columnsOf(layout: SceneLayout, module: SceneModule, span: ModuleSpan, width: ModuleWidth): number {
  if (span === 'pair') return 6;
  if (module.size !== undefined) return sizedColumns(module.size, width);
  if (width === 'wide' && layout === 'mosaic') return span === 'wide' ? 8 : 4;
  if (width === 'wide' && layout === 'split') return 12;
  return span === 'wide' ? 12 : 6;
}

/**
 * Spans for a two-up grid in reading order. A compact card that would sit alone
 * in its row, or next to a card of a very different height, takes the full width
 * instead: a lone tall neighbour leaves a column of dead space beside it.
 *
 * A module with an explicit `size` is never adjusted: the model chose its width.
 * Once one is present the pass counts real columns, so an automatic card only
 * stays compact when it actually shares a 12-column row with something.
 */
export function balancedSpans(layout: SceneLayout, entries: IndexedModule[], width: ModuleWidth = 'narrow'): ModuleSpan[] {
  const sized = entries.map(({ module }) => module.size !== undefined);
  const spans = entries.map(({ module }, i) => (sized[i]
    ? sizedSpan(layout, module, width)
    : moduleSpan(layout, module.kind, width, module.span)));
  const close = (a: number, b: number) =>
    Math.abs(estimateHeight(entries[a].module) - estimateHeight(entries[b].module)) <= PAIR_TOLERANCE_PX;

  if (!sized.includes(true)) {
    // The directives only seed the array; the pairing and height-tolerance pass
    // below then runs over the result exactly as it did before they existed.
    let i = 0;
    while (i < spans.length) {
      const pairs = i + 1 < spans.length && spans[i] !== 'wide' && spans[i + 1] !== 'wide' && close(i, i + 1);
      if (pairs) {
        i += 2;
      } else {
        if (spans[i] === 'compact') spans[i] = 'wide';
        i += 1;
      }
    }
    return spans;
  }

  const cols = (i: number) => columnsOf(layout, entries[i].module, spans[i], width);
  let used = 0;
  for (let i = 0; i < spans.length; i += 1) {
    if (used + cols(i) > 12) used = 0;
    if (!sized[i] && spans[i] === 'compact') {
      const next = i + 1;
      const shares = used > 0
        || (next < spans.length && cols(i) + cols(next) <= 12 && (sized[next] || close(i, next)));
      if (!shares) spans[i] = 'wide';
    }
    used += cols(i);
    if (used >= 12) used = 0;
  }
  return spans;
}

/**
 * Column overrides that close the holes `balancedSpans` leaves. Rows are packed
 * in reading order; a row that ends short of 12 because the next card does not
 * fit, or because the list ran out, widens one of its own cards by the gap: the
 * last automatic one if the row has any, otherwise its last card. Everything
 * that already tiles keeps its size, so `undefined` means "leave it alone".
 *
 * `keepTail` leaves the final row open while more modules may still arrive: the
 * next card is likely to fill it, and stretching now would only snap back.
 */
export function fillRows(
  layout: SceneLayout,
  entries: IndexedModule[],
  spans: ModuleSpan[],
  width: ModuleWidth = 'narrow',
  keepTail = false,
): Array<number | undefined> {
  const filled: Array<number | undefined> = entries.map(() => undefined);
  const cols = (i: number) => columnsOf(layout, entries[i].module, spans[i], width);
  let row: number[] = [];
  let used = 0;

  const close = () => {
    if (row.length > 0 && used < 12) {
      const target = [...row].reverse().find(i => entries[i].module.size === undefined) ?? row[row.length - 1];
      filled[target] = cols(target) + 12 - used;
    }
    row = [];
    used = 0;
  };

  for (let i = 0; i < entries.length; i += 1) {
    if (used + cols(i) > 12) close();
    row.push(i);
    used += cols(i);
    if (used >= 12) close();
  }
  if (!keepTail) close();
  return filled;
}

/**
 * A layout whose rail set is empty has no rail at all, so no directive can
 * conjure one. Otherwise `slot` decides, but only for kinds that read well in a
 * narrow column: the rail is a gutter, and a chart or a code block dropped into
 * it would be unreadable however deliberate the request was.
 */
function isRailed(module: SceneModule, railKinds: ReadonlySet<FactKind>, honourSlot: boolean): boolean {
  if (railKinds.size === 0) return false;
  // A size is a width on the main module row, so a sized card with no slot of
  // its own belongs there on every screen.
  if (module.size !== undefined && module.slot === undefined) return false;
  if (!honourSlot || module.slot === undefined) return railKinds.has(module.kind);
  return module.slot === 'rail' && COMPACT_KINDS.has(module.kind);
}

/**
 * Splits modules between the reading column and the side rail. `honourSlot` is
 * true on desktop only: the rail is a desktop arrangement, and a narrow screen
 * stacks everything in reading order regardless.
 */
export function partitionModules(
  layout: SceneLayout,
  modules: SceneModule[],
  honourSlot = false,
): { main: IndexedModule[]; rail: IndexedModule[] } {
  const railKinds = RAIL_KINDS[layout];
  const main: IndexedModule[] = [];
  const rail: IndexedModule[] = [];
  modules.forEach((module, index) => {
    (isRailed(module, railKinds, honourSlot) ? rail : main).push({ module, index });
  });
  return { main, rail };
}

/**
 * Seed for a card's decoration: its place in the scene's module list and its
 * kind, both fixed for the whole turn. Never the on-screen ordinal, which shifts
 * as main cards stream in ahead of the rail, and never model text, which streams.
 */
export function patternSeed(modules: readonly SceneModule[], module: SceneModule): string {
  return `${modules.indexOf(module)}|${module.kind}`;
}

/** Five or more weighted points with short labels read as a line; anything else reads as bars. */
export function chartReadsAsLine(items: readonly SceneItem[]): boolean {
  const points = items.filter(it => typeof it.weight === 'number');
  return points.length >= 5 && points.every(p => p.label.length <= 12);
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
  panel: 64,
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
