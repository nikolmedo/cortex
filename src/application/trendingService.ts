import { sanitizeText } from '../domain/Scene';
import type { Locale } from '../i18n/translations';

export const TRENDING_TIMEOUT_MS = 6_000;
export const TRENDING_MAX = 5;
export const TRENDING_MAX_LENGTH = 90;
export const TRENDING_CACHE_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_GEO = 'US';

/** Up to five sanitised, non-empty strings; anything malformed yields []. */
export function parseTrendingResponse(raw: unknown): string[] {
  const list = raw && typeof raw === 'object' ? (raw as { questions?: unknown }).questions : undefined;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const entry of list) {
    if (out.length >= TRENDING_MAX) break;
    if (typeof entry !== 'string') continue;
    const q = sanitizeText(entry, TRENDING_MAX_LENGTH);
    if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

/**
 * Region for the trends feed: the first browser language with a two-letter
 * region, preferring one in the app's language (es-AR -> AR); US otherwise.
 */
export function deriveGeo(locale: Locale, languages: readonly string[]): string {
  const regions = languages.map(tag => {
    const [lang = '', region = ''] = tag.split(/[-_]/);
    return { lang: lang.toLowerCase(), region: /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : '' };
  }).filter(r => r.region);
  return (regions.find(r => r.lang === locale) ?? regions[0])?.region ?? DEFAULT_GEO;
}

export function trendingCacheKey(geo: string, lang: Locale): string {
  return `cortex.trending.${geo}.${lang}`;
}

interface CachedTrending {
  at: number;
  questions: string[];
}

/** Cached questions still inside the TTL, re-validated on the way out; null on a miss or any storage error. */
export function readTrendingCache(storage: Storage | undefined, key: string, now: number): string[] | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedTrending>;
    if (typeof parsed.at !== 'number' || now - parsed.at > TRENDING_CACHE_TTL_MS || now < parsed.at) return null;
    const questions = parseTrendingResponse(parsed);
    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

export function writeTrendingCache(storage: Storage | undefined, key: string, questions: string[], now: number): void {
  if (questions.length === 0) return;
  try {
    storage?.setItem(key, JSON.stringify({ at: now, questions } satisfies CachedTrending));
  } catch {
    // Storage may be unavailable or full; the questions just are not cached.
  }
}

/** Trending questions for the landing; [] on any failure so the caller keeps its static examples. Rejects only on abort. */
export async function fetchTrendingQuestions(lang: Locale, geo: string, signal?: AbortSignal): Promise<string[]> {
  const timeout = AbortSignal.timeout(TRENDING_TIMEOUT_MS);
  const linked = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const params = new URLSearchParams({ lang, geo });
    const res = await fetch(`/api/trending?${params}`, { signal: linked, headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    return parseTrendingResponse(await res.json());
  } catch (err) {
    if (signal?.aborted) throw err;
    return [];
  }
}
