import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TrendingService } from '../application/trending';
import { createTrendingRouter, parseTrendingParams } from './trendingRouter';

describe('parseTrendingParams', () => {
  it('accepts supported languages and two uppercase letters', () => {
    expect(parseTrendingParams({ lang: 'es', geo: 'AR' })).toEqual({ lang: 'es', geo: 'AR' });
    expect(parseTrendingParams({ lang: 'en', geo: 'GB' })).toEqual({ lang: 'en', geo: 'GB' });
  });

  it.each([
    [{}, { lang: 'en', geo: 'US' }],
    [{ lang: 'fr', geo: 'ar' }, { lang: 'en', geo: 'US' }],
    [{ lang: ['es'], geo: ['AR'] }, { lang: 'en', geo: 'US' }],
    [{ lang: 'es', geo: 'ARG' }, { lang: 'es', geo: 'US' }],
    [{ geo: 'A1' }, { lang: 'en', geo: 'US' }],
    [{ geo: 'AR&x=1' }, { lang: 'en', geo: 'US' }],
    [{ geo: 'ÁR' }, { lang: 'en', geo: 'US' }],
  ])('falls back for %j', (query, expected) => {
    expect(parseTrendingParams(query)).toEqual(expected);
  });

  it('survives a missing query object', () => {
    expect(parseTrendingParams(undefined)).toEqual({ lang: 'en', geo: 'US' });
  });
});

describe('GET /api/trending', () => {
  const get = vi.fn<TrendingService['get']>();
  let base = '';
  let close: () => void = () => undefined;

  beforeAll(async () => {
    const app = express();
    app.use('/api', createTrendingRouter({ get }));
    const server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  afterAll(() => close());

  it('returns questions with a public cache header', async () => {
    get.mockResolvedValueOnce({ questions: ['Why is the sky blue?'], generatedAt: '2026-09-24T00:00:00.000Z' });
    const res = await fetch(`${base}/api/trending?lang=es&geo=AR`);
    expect(get).toHaveBeenLastCalledWith('AR', 'es');
    expect(res.headers.get('cache-control')).toBe('public, max-age=600');
    expect(await res.json()).toEqual({ questions: ['Why is the sky blue?'], geo: 'AR', generatedAt: '2026-09-24T00:00:00.000Z' });
  });

  it('normalises bad params and never caches an empty list', async () => {
    get.mockResolvedValueOnce({ questions: [], generatedAt: null });
    const res = await fetch(`${base}/api/trending?lang=xx&geo=zz`);
    expect(get).toHaveBeenLastCalledWith('US', 'en');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ questions: [], geo: 'US', generatedAt: null });
  });

  it('answers an empty list when the service throws', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    get.mockRejectedValueOnce(new Error('unexpected'));
    const res = await fetch(`${base}/api/trending`);
    expect(res.status).toBe(200);
    expect((await res.json()).questions).toEqual([]);
  });
});
