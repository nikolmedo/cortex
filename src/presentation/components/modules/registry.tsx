import type { ComponentType } from 'react';
import type { FactKind, SceneModule } from '../../../domain/Scene';
import { ChartModule } from './ChartModule';
import { PanelModule } from './PanelModule';
import {
  CodeModule, ComparisonModule, FormulaModule, KeyValueModule, ListModule, ProgressModule, ProseModule,
  ProsConsModule, QuoteModule, RankingModule, StatsModule, StepsModule, TagsModule, TimelineModule,
} from './kinds';

export interface ModuleRendererProps {
  module: SceneModule;
}

/** One renderer per module kind; ModuleCard supplies the shared shell. */
export const MODULE_RENDERERS: Record<FactKind, ComponentType<ModuleRendererProps>> = {
  list: ListModule,
  timeline: TimelineModule,
  stats: StatsModule,
  comparison: ComparisonModule,
  quote: QuoteModule,
  ranking: RankingModule,
  progress: ProgressModule,
  keyvalue: KeyValueModule,
  tags: TagsModule,
  steps: StepsModule,
  formula: FormulaModule,
  code: CodeModule,
  prose: ProseModule,
  proscons: ProsConsModule,
  chart: ChartModule,
  panel: PanelModule,
};
