import { describe, expect, it, vi } from 'vitest';
import { createTtlCache } from './trendingCache';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('createTtlCache', () => {
  it('serves a hit inside the TTL and reloads after it', async () => {
    let t = 0;
    const cache = createTtlCache<number>({ ttlMs: 100, now: () => t });
    const load = vi.fn(async () => t);
    expect((await cache.get('k', load))?.value).toBe(0);
    t = 99;
    expect((await cache.get('k', load))?.value).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
    t = 100;
    expect((await cache.get('k', load))?.value).toBe(100);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps keys independent', async () => {
    const cache = createTtlCache<string>({ ttlMs: 100 });
    await cache.get('a', async () => 'A');
    expect((await cache.get('b', async () => 'B'))?.value).toBe('B');
    expect((await cache.get('a', async () => 'X'))?.value).toBe('A');
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const cache = createTtlCache<string>({ ttlMs: 100 });
    const gate = deferred<string>();
    const load = vi.fn(() => gate.promise);
    const calls = [cache.get('k', load), cache.get('k', load), cache.get('k', load)];
    gate.resolve('v');
    const results = await Promise.all(calls);
    expect(load).toHaveBeenCalledTimes(1);
    expect(results.map(r => r?.value)).toEqual(['v', 'v', 'v']);
  });

  it('serves the last good value when a reload fails, and reports it once', async () => {
    let t = 0;
    const onError = vi.fn();
    const cache = createTtlCache<string>({ ttlMs: 100, now: () => t, onError });
    await cache.get('k', async () => 'good');
    t = 500;
    const gate = deferred<string>();
    const failing = vi.fn(() => gate.promise);
    const calls = [cache.get('k', failing), cache.get('k', failing)];
    gate.reject(new Error('boom'));
    const results = await Promise.all(calls);
    expect(results.map(r => r?.value)).toEqual(['good', 'good']);
    expect(results[0]?.at).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('k', expect.any(Error), true);
  });

  it('returns null without a stale value and does not reload during the cooldown', async () => {
    let t = 0;
    const onError = vi.fn();
    const cache = createTtlCache<string>({ ttlMs: 100, failureCooldownMs: 1000, now: () => t, onError });
    expect(await cache.get('k', async () => { throw new Error('down'); })).toBeNull();
    expect(onError).toHaveBeenCalledWith('k', expect.any(Error), false);
    const retry = vi.fn(async () => 'up');
    t = 999;
    expect(await cache.get('k', retry)).toBeNull();
    expect(retry).not.toHaveBeenCalled();
    t = 1000;
    expect((await cache.get('k', retry))?.value).toBe('up');
    expect((await cache.get('k', retry))?.value).toBe('up');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('serves the stale value without a load while cooling down', async () => {
    let t = 0;
    const cache = createTtlCache<string>({ ttlMs: 100, failureCooldownMs: 1000, now: () => t });
    await cache.get('k', async () => 'good');
    t = 500;
    await cache.get('k', async () => { throw new Error('down'); });
    const load = vi.fn(async () => 'fresh');
    t = 600;
    expect((await cache.get('k', load))?.value).toBe('good');
    expect(load).not.toHaveBeenCalled();
  });

  it('clears the in-flight slot even when the load throws synchronously', async () => {
    const cache = createTtlCache<string>({ ttlMs: 100, failureCooldownMs: 0 });
    const sync = () => { throw new Error('sync'); };
    expect(await cache.get('k', sync as () => Promise<string>)).toBeNull();
    expect((await cache.get('k', async () => 'ok'))?.value).toBe('ok');
  });
});
