import { GraphDataSchema, type GraphData } from '../domain/GraphData.js';
import { CortexError } from '../domain/errors.js';

export function extractJSON(text: string): unknown {
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('no JSON found');
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {
      type: 'unknown',
      title: 'Parse Error',
      subtitle: 'Could not parse response',
      summary: '',
      image_url: '',
      image_query: 'abstract data visualization',
      meta: {},
      graph: [],
    };
  }
}

export function validateGraphData(raw: unknown): GraphData {
  const result = GraphDataSchema.safeParse(raw);
  if (!result.success) {
    throw new CortexError(
      `Validation failed: ${result.error.message}`,
      'VALIDATION_ERROR',
    );
  }
  return result.data;
}
