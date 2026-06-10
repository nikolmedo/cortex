import { CYAN, MAGENTA, PURPLE } from '../infrastructure/constants';
import type { GraphDataType } from './GraphData';

export const TYPE_COLOR: Record<GraphDataType, string> = {
  person: CYAN,
  place: '#00FF88',
  product: '#FFB800',
  film: MAGENTA,
  series: MAGENTA,
  company: PURPLE,
  event: '#FF8C00',
  concept: '#A855F7',
  sports_team: '#10B981',
  album: '#FF6B35',
  book: CYAN,
  unknown: CYAN,
};

export function typeColor(type: GraphDataType | undefined): string {
  return (type && TYPE_COLOR[type]) || CYAN;
}
