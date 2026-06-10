import { z } from 'genkit';

export const VALID_TYPES = [
  'person', 'place', 'product', 'film', 'series', 'company',
  'event', 'concept', 'sports_team', 'album', 'book', 'unknown',
] as const;

export type GraphDataType = typeof VALID_TYPES[number];

export const GraphCategorySchema = z.object({
  category: z.string(),
  color: z.string(),
  image_query: z.string().optional(),
  facts: z.array(z.string()),
});

export const GraphDataSchema = z.object({
  type: z.enum(VALID_TYPES).catch('unknown'),
  title: z.string(),
  subtitle: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  image_url: z.string().optional().default(''),
  image_query: z.string().optional().default(''),
  meta: z.record(z.string()).optional().default({}),
  graph: z.array(GraphCategorySchema),
});

export type GraphCategory = z.infer<typeof GraphCategorySchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
