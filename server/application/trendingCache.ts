export interface CacheEntry<T> {
  value: T;
  /** Epoch ms the value was loaded. */
  at: number;
}

/**
 * In-memory TTL cache with single-flight loads and stale-while-error: callers
 * for the same key share one in-flight load, and a failed load falls back to
 * the last good value (or null when there never was one). A load never takes
 * a caller's signal, so one client going away cannot fail the shared load.
 * After a failure the key cools down: no new load starts for `failureCooldownMs`.
 */
export function createTtlCache<T>(options: {
  ttlMs: number;
  /** How long a failed key serves stale/null without reloading. */
  failureCooldownMs?: number;
  now?: () => number;
  onError?: (key: string, err: unknown, stale: boolean) => void;
}) {
  const now = options.now ?? Date.now;
  const cooldownMs = options.failureCooldownMs ?? 5 * 60_000;
  const failedAt = new Map<string, number>();
  const entries = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<CacheEntry<T> | null>>();

  async function run(key: string, load: () => Promise<T>): Promise<CacheEntry<T> | null> {
    try {
      const entry = { value: await load(), at: now() };
      entries.set(key, entry);
      failedAt.delete(key);
      return entry;
    } catch (err) {
      failedAt.set(key, now());
      const stale = entries.get(key) ?? null;
      options.onError?.(key, err, stale !== null);
      return stale;
    }
  }

  return {
    get(key: string, load: () => Promise<T>): Promise<CacheEntry<T> | null> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < options.ttlMs) return Promise.resolve(hit);
      const pending = inflight.get(key);
      if (pending) return pending;
      const failed = failedAt.get(key);
      if (failed !== undefined && now() - failed < cooldownMs) {
        return Promise.resolve(entries.get(key) ?? null);
      }
      const flight = run(key, load);
      inflight.set(key, flight);
      // Cleared after registration even when the load failed synchronously.
      void flight.finally(() => {
        if (inflight.get(key) === flight) inflight.delete(key);
      });
      return flight;
    },
  };
}
