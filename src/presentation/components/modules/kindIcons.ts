import {
  Braces, ChartLine, Clock, Code, FileText, Gauge, List, ListOrdered, Quote, Radical, Scale, Sigma, Tags,
  ThumbsUp, Trophy, type LucideIcon,
} from 'lucide-react';
import type { FactKind } from '../../../domain/Scene';
import type { TranslationKey } from '../../../i18n/translations';

export const KIND_ICON: Record<FactKind, LucideIcon> = {
  list: List,
  timeline: Clock,
  stats: Sigma,
  comparison: Scale,
  quote: Quote,
  ranking: Trophy,
  progress: Gauge,
  keyvalue: Braces,
  tags: Tags,
  steps: ListOrdered,
  formula: Radical,
  code: Code,
  prose: FileText,
  proscons: ThumbsUp,
  chart: ChartLine,
};

export function kindLabelKey(kind: FactKind): TranslationKey {
  return `scene.kind.${kind}`;
}
