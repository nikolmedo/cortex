import { sanitizeText } from '../domain/Scene.js';

/**
 * Google Trends "trending now" RSS (no key). Everything in the feed is
 * untrusted text: only the term, the traffic label and headline titles/sources
 * are read, URLs and pictures are never extracted.
 */

export interface TrendItem {
  term: string;
  traffic: string;
  headlines: Array<{ title: string; source: string }>;
}

export const TRENDS_LIMITS = {
  items: 10,
  headlines: 2,
  term: 80,
  traffic: 16,
  title: 160,
  source: 60,
} as const;

const FETCH_TIMEOUT_MS = 4_000;
const MAX_BYTES = 512 * 1024;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
  return String.fromCodePoint(n);
}

/** Single pass, so "&amp;lt;" decodes to "&lt;" and never to "<". Unknown entities are kept verbatim. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      return codePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Text of a leaf element: CDATA is taken literally, everything else is entity-decoded. */
function textOf(raw: string): string {
  let out = '';
  let rest = raw;
  for (;;) {
    const start = rest.indexOf('<![CDATA[');
    if (start === -1) break;
    const end = rest.indexOf(']]>', start);
    if (end === -1) break;
    out += decodeEntities(rest.slice(0, start)) + rest.slice(start + 9, end);
    rest = rest.slice(end + 3);
  }
  return out + decodeEntities(rest);
}

function leaf(block: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? textOf(m[1]) : '';
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return Array.from(xml.matchAll(re), m => m[1]);
}

function clean(text: string, max: number): string {
  return sanitizeText(text.replace(URL_RE, ' '), max);
}

/** Top trends with up to two headlines each; items without a term are skipped. */
export function parseTrendsRss(xml: string, max: number = TRENDS_LIMITS.items): TrendItem[] {
  const items: TrendItem[] = [];
  for (const item of blocks(xml, 'item')) {
    if (items.length >= max) break;
    const term = clean(leaf(item, 'title'), TRENDS_LIMITS.term);
    if (!term) continue;
    const headlines: TrendItem['headlines'] = [];
    for (const news of blocks(item, 'ht:news_item')) {
      if (headlines.length >= TRENDS_LIMITS.headlines) break;
      const title = clean(leaf(news, 'ht:news_item_title'), TRENDS_LIMITS.title);
      if (!title) continue;
      headlines.push({ title, source: clean(leaf(news, 'ht:news_item_source'), TRENDS_LIMITS.source) });
    }
    items.push({ term, traffic: clean(leaf(item, 'ht:approx_traffic'), TRENDS_LIMITS.traffic), headlines });
  }
  return items;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`trends feed exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchTrends(geo: string, fetchImpl: typeof fetch = fetch): Promise<TrendItem[]> {
  if (!/^[A-Z]{2}$/.test(geo)) throw new Error(`invalid geo ${JSON.stringify(geo)}`);
  const res = await fetchImpl(`https://trends.google.com/trending/rss?geo=${geo}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
    redirect: 'error',
  });
  if (!res.ok) throw new Error(`trends feed HTTP ${res.status}`);
  const items = parseTrendsRss(await readCapped(res, MAX_BYTES));
  if (items.length === 0) throw new Error('trends feed had no items');
  return items;
}
