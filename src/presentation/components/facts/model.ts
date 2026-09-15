import type { ReactElement } from 'react';
import type { FactKind, SceneCategory, SceneItem } from '../../../domain/Scene';

export type FactBlockVariant = 'graph' | 'panel' | 'mobile';

export interface FactBlockProps {
  category: SceneCategory;
  variant: FactBlockVariant;
  /** Validated hex, already safe to put into the `--c` custom property. */
  color: string;
  /** For 'graph' variant only: render just this item index (one card per item). Omit to render the whole category. */
  itemIndex?: number;
}

export type FactKindRenderer = (props: FactBlockProps) => ReactElement | null;

const COMPOSITE_KINDS: ReadonlySet<FactKind> = new Set<FactKind>(['timeline', 'comparison', 'ranking', 'progress']);

/** Kinds that render as ONE composite node per category in the graph instead of one node per item. */
export function isCompositeKind(kind: FactKind): boolean {
  return COMPOSITE_KINDS.has(kind);
}

/** Structured items when present and non-empty, otherwise the plain facts wrapped as items. */
export function categoryItems(category: SceneCategory): SceneItem[] {
  if (category.items && category.items.length > 0) return category.items;
  return category.facts.map(label => ({ label }));
}
