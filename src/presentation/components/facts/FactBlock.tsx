import type { ReactElement } from 'react';
import type { FactKind } from '../../../domain/Scene';
import { categoryKind } from '../../../domain/Scene';
import { ComparisonFact, ProgressFact, RankingFact, TimelineFact } from './composite';
import type { FactBlockProps, FactKindRenderer } from './model';
import { perItemRenderer } from './perItem';

export { categoryItems, isCompositeKind } from './model';
export type { FactBlockProps, FactBlockVariant, FactKindRenderer } from './model';

/** Mutable registry: every kind is present; specialised renderers replace entries via registerFactRenderer. */
export const FACT_RENDERERS: Record<FactKind, FactKindRenderer> = {
  list: perItemRenderer('list'),
  timeline: TimelineFact,
  stats: perItemRenderer('stats'),
  comparison: ComparisonFact,
  quote: perItemRenderer('quote'),
  ranking: RankingFact,
  progress: ProgressFact,
  keyvalue: perItemRenderer('keyvalue'),
  tags: perItemRenderer('tags'),
};

export function registerFactRenderer(kind: FactKind, renderer: FactKindRenderer): void {
  FACT_RENDERERS[kind] = renderer;
}

/** Looks up the renderer for `category.kind` (fallback 'list') and delegates to it. */
export function FactBlock(props: FactBlockProps): ReactElement | null {
  const Renderer = FACT_RENDERERS[categoryKind(props.category)] ?? FACT_RENDERERS.list;
  return <Renderer {...props} />;
}
