import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deriveGeo,
  fetchTrendingQuestions,
  parseTrendingResponse,
  readTrendingCache,
  TRENDING_CACHE_TTL_MS,
  TRENDING_MAX_LENGTH,
  trendingCacheKey,
  writeTrendingCache,
} from './trendingService';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: k => map.get(k) ?? null,
    key: i => Array.from(map.keys())[i] ?? null,
    removeItem: k => { map.delete(k); },
    setItem: (k, v) => { map.set(k, v); },
  };
}

describe('parseTrendingResponse', () => {
  it('keeps at most five sanitised strings', () => {
    const out = parseTrendingResponse({ questions: ['a <b>', 'b', 'c', 'd', 'e', 'f'] });
    expect(out).toEqual(['a ‹b›', 'b', 'c', 'd', 'e']);
  });

  it('caps the length and drops non-strings, blanks and duplicates', () => {
    const out = parseTrendingResponse({ questions: ['x'.repeat(200), 1, null, '   ', 'q', 'q'] });
    expect(out[0].length).toBeLessThanOrEqual(TRENDING_MAX_LENGTH);
    expect(out.slice(1)).toEqual(['q']);
  });

  it.each([null, undefined, 'x', [], { questions: 'x' }, { questions: {} }])('returns [] for %j', raw => {
    expect(parseTrendingResponse(raw)).toEqual([]);
  });
});

describe('deriveGeo', () => {
  it.each([
    ['es', ['es-AR'], 'AR'],
    ['es', ['en-US', 'es-MX'], 'MX'],
    ['en', ['es-AR', 'en-GB'], 'GB'],
    ['en', ['es-AR'], 'AR'],
    ['es', ['es-419'], 'US'],
    ['es', ['es'], 'US'],
    ['en', [], 'US'],
    ['en', ['en_au'], 'AU'],
    ['en', ['zh-Hant-TW'], 'US'],
  ] as const)('%s + %j -> %s', (locale, languages, expected) => {
    expect(deriveGeo(locale, languages)).toBe(expected);
  });
});

describe('session cache', () => {
  const key = trendingCacheKey('AR', 'es');

  it('round-trips inside the TTL and expires after it', () => {
    const storage = memoryStorage();
    writeTrendingCache(storage, key, ['q1', 'q2'], 1000);
    expect(readTrendingCache(storage, key, 1000 + TRENDING_CACHE_TTL_MS)).toEqual(['q1', 'q2']);
    expect(readTrendingCache(storage, key, 1001 + TRENDING_CACHE_TTL_MS)).toBeNull();
  });

  it('never stores an empty list and re-validates what it reads', () => {
    const storage = memoryStorage();
    writeTrendingCache(storage, key, [], 0);
    expect(storage.length).toBe(0);
    storage.setItem(key, JSON.stringify({ at: 0, questions: ['<script>', 5] }));
    expect(readTrendingCache(storage, key, 1)).toEqual(['‹script›']);
    storage.setItem(key, '{not json');
    expect(readTrendingCache(storage, key, 1)).toBeNull();
  });

  it('swallows storage errors', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('full'); },
    } as unknown as Storage;
    expect(readTrendingCache(broken, key, 0)).toBeNull();
    expect(() => writeTrendingCache(broken, key, ['q'], 0)).not.toThrow();
    expect(readTrendingCache(undefined, key, 0)).toBeNull();
  });
});

describe('fetchTrendingQuestions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the validated params and parses the body', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ questions: ['Why?', 'How now?'], geo: 'AR' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTrendingQuestions('es', 'AR')).resolves.toEqual(['Why?', 'How now?']);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/trending?lang=es&geo=AR');
  });

  it('returns [] on HTTP and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(fetchTrendingQuestions('en', 'US')).resolves.toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(fetchTrendingQuestions('en', 'US')).resolves.toEqual([]);
  });

  it('rejects when the caller aborts', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const controller = new AbortController();
    const pending = fetchTrendingQuestions('en', 'US', controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/);
  });
});
