export const VALID_TYPES = [
  'person', 'place', 'product', 'film', 'series', 'company',
  'event', 'concept', 'sports_team', 'album', 'book', 'unknown',
] as const;

export type GraphDataType = typeof VALID_TYPES[number];

export interface GraphCategory {
  category: string;
  color: string;
  image_query?: string;
  facts: string[];
}

export interface GraphData {
  type: GraphDataType;
  title: string;
  subtitle?: string;
  summary?: string;
  image_url?: string;
  image_query?: string;
  meta?: Record<string, string>;
  graph: GraphCategory[];
}
