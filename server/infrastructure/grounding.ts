import { LIMITS, safeHttpsUrl } from '../domain/Scene.js';

export interface GroundingSource {
  title: string;
  url: string;
}

interface RawGroundingChunk {
  web?: { uri?: unknown; title?: unknown };
}

interface RawGeminiResponse {
  candidates?: Array<{ groundingMetadata?: { groundingChunks?: unknown } }>;
}

/**
 * Reads web sources from the raw Gemini response exposed as `res.custom`.
 * Keeps https URLs only, dedupes by host + path and caps at LIMITS.maxSources.
 */
export function sourcesFromGrounding(custom: unknown): GroundingSource[] {
  const chunks = (custom as RawGeminiResponse | undefined)?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set<string>();
  const out: GroundingSource[] = [];

  for (const chunk of chunks as RawGroundingChunk[]) {
    const web = chunk?.web;
    const url = safeHttpsUrl(typeof web?.uri === 'string' ? web.uri : '');
    if (url === '') continue;

    const parsed = new URL(url);
    const key = `${parsed.host}${parsed.pathname}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const title = typeof web?.title === 'string' && web.title.trim() !== '' ? web.title.trim() : parsed.host;
    out.push({ title, url });
    if (out.length >= LIMITS.maxSources) break;
  }

  return out;
}
