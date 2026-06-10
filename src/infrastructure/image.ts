export function loremflickrUrl(query: string, w: number, h: number, lock?: number): string {
  const kw = (query || 'abstract')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(',');
  const base = `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}`;
  return lock != null ? `${base}?lock=${lock}` : base;
}

/** Size presets so every consumer requests a resolution that reads well. */
export const IMG = {
  node: (query: string, lock?: number) => loremflickrUrl(query, 200, 200, lock),
  category: (query: string, lock?: number) => loremflickrUrl(query, 160, 160, lock),
  hero: (query: string, lock?: number) => loremflickrUrl(query, 800, 500, lock),
  lightbox: (query: string, lock?: number) => loremflickrUrl(query, 1000, 750, lock),
} as const;
