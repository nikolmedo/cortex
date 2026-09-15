import type { Scene } from '../../../domain/Scene';

export type DossierBlock = 'spotlight' | 'summary' | 'meta' | 'connections' | 'sources';

export interface DossierLayout {
  /** Block order after removing blocks the scene has no data for. */
  blocks: DossierBlock[];
  /** Whether the category at `index` starts expanded. */
  openByDefault: (index: number) => boolean;
  /** Spine archetype: numbered rail beside every category. */
  indexRail: boolean;
}

const LEAD_WITH_SUMMARY: DossierBlock[] = ['summary', 'spotlight', 'meta', 'connections', 'sources'];
const LEAD_WITH_SPOTLIGHT: DossierBlock[] = ['spotlight', 'summary', 'meta', 'connections', 'sources'];

/** Section order, collapse defaults and index rail derived from the scene presentation. */
export function dossierLayout(scene: Scene): DossierLayout {
  const { mood, archetype } = scene.presentation;
  const order = mood === 'archival' ? LEAD_WITH_SUMMARY : LEAD_WITH_SPOTLIGHT;
  const present: Record<DossierBlock, boolean> = {
    spotlight: scene.spotlight != null,
    summary: scene.summary !== '',
    meta: Object.keys(scene.meta).length > 0,
    connections: scene.graph.length > 0,
    sources: (scene.sources?.length ?? 0) > 0,
  };
  const allOpen = mood === 'kinetic' || mood === 'volatile';

  return {
    blocks: order.filter(block => present[block]),
    openByDefault: index => allOpen || index === 0,
    indexRail: archetype === 'spine',
  };
}
