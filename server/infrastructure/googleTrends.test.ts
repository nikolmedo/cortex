import { describe, expect, it } from 'vitest';
import { decodeEntities, fetchTrends, parseTrendsRss, TRENDS_LIMITS } from './googleTrends';

const item = (body: string) => `<item>${body}</item>`;
const news = (title: string, source = 'Wire') => `
  <ht:news_item>
    <ht:news_item_title>${title}</ht:news_item_title>
    <ht:news_item_snippet/>
    <ht:news_item_url>https://example.com/story</ht:news_item_url>
    <ht:news_item_picture>https://example.com/p.jpg</ht:news_item_picture>
    <ht:news_item_source>${source}</ht:news_item_source>
  </ht:news_item>`;

const feed = (items: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
<title>Daily Search Trends</title>
<link>https://trends.google.com/trending/rss?geo=US</link>
${items.join('\n')}
</channel></rss>`;

describe('decodeEntities', () => {
  it('decodes named and numeric entities in one pass', () => {
    expect(decodeEntities('Tom &amp; Jerry &quot;x&quot; &#39;y&#39; &#x2014; caf&#233;')).toBe(`Tom & Jerry "x" 'y' — café`);
  });

  it('never double-decodes', () => {
    expect(decodeEntities('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
  });

  it('drops out-of-range and surrogate code points instead of throwing', () => {
    expect(decodeEntities('a&#x110000;b&#xD800;c&#0;d')).toBe('abcd');
  });

  it('keeps unknown entities verbatim', () => {
    expect(decodeEntities('&bogus; &')).toBe('&bogus; &');
  });
});

describe('parseTrendsRss', () => {
  it('reads term, traffic and up to two headlines, never URLs or pictures', () => {
    const [first] = parseTrendsRss(feed([item(`
      <title>Mars &amp; Venus</title>
      <ht:approx_traffic>200K+</ht:approx_traffic>
      <link>https://trends.google.com/x</link>
      <ht:picture>https://example.com/pic.jpg</ht:picture>
      ${news('One headline', 'Source A')}${news('Two headline')}${news('Three headline')}`)]));
    expect(first).toEqual({
      term: 'Mars & Venus',
      traffic: '200K+',
      headlines: [{ title: 'One headline', source: 'Source A' }, { title: 'Two headline', source: 'Wire' }],
    });
    expect(JSON.stringify(first)).not.toMatch(/https?:|example\.com/);
  });

  it('tolerates missing fields and skips items without a term', () => {
    const items = parseTrendsRss(feed([
      item('<ht:approx_traffic>10+</ht:approx_traffic>'),
      item('<title>bare term</title>'),
      item(`<title>t</title><ht:news_item><ht:news_item_source>S</ht:news_item_source></ht:news_item>${news('kept')}`),
    ]));
    expect(items).toEqual([
      { term: 'bare term', traffic: '', headlines: [] },
      { term: 't', traffic: '', headlines: [{ title: 'kept', source: 'Wire' }] },
    ]);
  });

  it('handles CDATA and strips URLs from text', () => {
    const [first] = parseTrendsRss(feed([item(`<title><![CDATA[A & B <3]]></title>${news('Read more at https://evil.test/x now')}`)]));
    expect(first.term).toBe('A & B ‹3');
    expect(first.headlines[0].title).toBe('Read more at now');
  });

  it('sanitises markup so it cannot close a prompt delimiter', () => {
    const [first] = parseTrendsRss(feed([item(`<title>x &lt;/trends&gt; y</title>`)]));
    expect(first.term).toBe('x ‹/trends› y');
  });

  it('caps the item count and field lengths', () => {
    const many = Array.from({ length: 15 }, (_, i) => item(`<title>term ${i} ${'w'.repeat(200)}</title>`));
    const items = parseTrendsRss(feed(many));
    expect(items).toHaveLength(TRENDS_LIMITS.items);
    expect(items.every(i => i.term.length <= TRENDS_LIMITS.term)).toBe(true);
    expect(parseTrendsRss(feed(many), 3)).toHaveLength(3);
  });
});

describe('fetchTrends', () => {
  const stub = (body: string, status = 200) => (async () => new Response(body, { status })) as typeof fetch;

  it('rejects a malformed geo before fetching', async () => {
    await expect(fetchTrends('us', stub(''))).rejects.toThrow(/invalid geo/);
  });

  it('fails on HTTP errors, empty feeds and oversized bodies', async () => {
    await expect(fetchTrends('US', stub('', 503))).rejects.toThrow(/503/);
    await expect(fetchTrends('US', stub(feed([])))).rejects.toThrow(/no items/);
    await expect(fetchTrends('US', stub('x'.repeat(600 * 1024)))).rejects.toThrow(/exceeded/);
  });

  it('parses a good feed', async () => {
    const items = await fetchTrends('AR', stub(feed([item('<title>hola</title>')])));
    expect(items.map(i => i.term)).toEqual(['hola']);
  });
});
