import { CortexError } from '../domain/errors.js';

/**
 * Returns the first balanced top-level `{...}` span in `text`, or null.
 * String literals and escape sequences are respected so braces inside values
 * do not confuse the scanner. Leading prose and trailing text are ignored.
 */
export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParse(source: string): unknown | undefined {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Extracts the JSON object from a model reply. Accepts a fenced block, a bare
 * object, or an object surrounded by prose. Throws PARSE_FAILURE when nothing
 * parses.
 */
export function extractJSON(text: string): unknown {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new CortexError('Model returned an empty response', 'PARSE_FAILURE');
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const sources = fenced ? [fenced[1], text] : [text];

  for (const source of sources) {
    const balanced = extractFirstJsonObject(source);
    if (balanced) {
      const parsed = tryParse(balanced);
      if (parsed !== undefined) return parsed;
    }
    // Widest brace span: recovers objects whose first `{` belongs to stray prose.
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = tryParse(source.slice(start, end + 1));
      if (parsed !== undefined) return parsed;
    }
  }

  throw new CortexError('Model response did not contain a parseable JSON object', 'PARSE_FAILURE');
}
