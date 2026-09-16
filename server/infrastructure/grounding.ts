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
    // Every chunk URL is a vertexaisearch redirect, so host + path never repeats;
    // `web.title` carries the real site (e.g. "reuters.com") and is the useful key.
    const title = typeof web?.title === 'string' && web.title.trim() !== '' ? web.title.trim() : parsed.host;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ title, url });
    if (out.length >= LIMITS.maxSources) break;
  }

  return out;
}
