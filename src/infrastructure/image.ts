export function loremflickrUrl(query: string, w: number, h: number, lock?: number): string {
  const kw = (query || 'abstract')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(',');
  const base = `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}`;
  return lock != null ? `${base}?lock=${lock}` : base;
}
