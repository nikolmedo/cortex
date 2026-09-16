import { isIP } from 'node:net';

/**
 * Proves that a hero image URL actually resolves to an image before the layout
 * is built around it.
 *
 * `safeHttpsUrl` (domain/Scene.ts) checks syntax only, and nothing ever fetched
 * the URL: a plausible-looking Wikimedia path the model invented passes every
 * check and then 404s in the browser, which is why the Kyoto fixture renders
 * with no image at all.
 *
 * This is a server-side fetch of a URL a language model chose, which is the
 * textbook SSRF shape — the model can name any host, including one that only
 * exists inside our network. Two independent gates, and a URL has to clear both:
 *
 *  1. A host allowlist. The prompt already steers the model at Wikimedia
 *     ("upload.wikimedia.org is preferred", "Wikipedia infobox image") and both
 *     fixtures that carry a hero use upload.wikimedia.org, so an allowlist costs
 *     nothing real and turns "any host the model can name" into three public
 *     CDNs. It lives in one exported constant so widening it is a single edit.
 *  2. Structural rejects that apply even to an allowlisted name: IP literals
 *     (v4 and v6), localhost, *.local, credentials in the URL, and non-default
 *     ports. The allowlist matches a name, not the address it resolves to, so
 *     these stay independent of it.
 *
 * Redirects are followed by hand, one hop, with the destination re-gated. Left
 * to `fetch`, an allowlisted host could bounce us onto 169.254.169.254 and the
 * request would be made before we ever saw the Location header.
 *
 * Never throws: every failure, including a malformed URL or a dead socket, is
 * just "not verified".
 */

/** Hosts whose images may be fetched. Matched exactly or on a label boundary (`*.host`). */
export const IMAGE_HOSTS: readonly string[] = [
  // The one CDN that serves every Wikipedia and Commons image, infobox pictures
  // included. In practice this is the only entry that ever matches.
  'upload.wikimedia.org',
  // Special:FilePath URLs, which redirect into upload.wikimedia.org.
  'commons.wikimedia.org',
  // Language wikis (en.wikipedia.org, es.wikipedia.org) for the same reason.
  'wikipedia.org',
];

/** One budget for the whole check: HEAD, the ranged GET retry and the redirect hop share it. */
const TIMEOUT_MS = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 1;
/** Bounded so a long-running process cannot grow a map keyed by model output. */
const CACHE_LIMIT = 256;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
/** A resource that is definitively absent; retrying it as a GET only doubles the latency. */
const ABSENT_CODES = new Set([404, 410]);

const cache = new Map<string, Promise<boolean>>();

function matchesHost(hostname: string): boolean {
  return IMAGE_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Parses and gates a URL. Returns the URL to fetch, or the reason it was
 * refused — a short code, never the URL itself, because a URL carrying
 * credentials is a secret and logging it would leak it.
 */
function gate(input: string): { url: URL } | { reason: string } {
  if (input.length > MAX_URL_LENGTH) return { reason: 'too-long' };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { reason: 'malformed' };
  }
  if (url.protocol !== 'https:') return { reason: 'not-https' };
  if (url.username !== '' || url.password !== '') return { reason: 'credentials' };
  // `new URL` drops an explicit :443, so anything left is a non-default port.
  if (url.port !== '') return { reason: 'non-standard-port' };

  // `hostname` keeps the brackets on an IPv6 literal: "[::1]".
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0) return { reason: 'ip-literal' };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return { reason: 'loopback-name' };
  if (!matchesHost(url.hostname)) return { reason: 'off-allowlist' };
  return { url };
}

function isImage(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').trim().toLowerCase().startsWith('image/');
}

/** Drains nothing: a host that ignores `Range` would otherwise stream the whole image at us. */
function discard(res: Response): void {
  void res.body?.cancel().catch(() => {});
}

async function probe(url: URL, method: 'HEAD' | 'GET', signal: AbortSignal, hops: number): Promise<boolean> {
  const res = await fetch(url, {
    method,
    signal,
    redirect: 'manual',
    // A single byte is enough to read the content type from a host that refuses HEAD.
    headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
  });
  discard(res);

  if (REDIRECT_CODES.has(res.status)) {
    const location = res.headers.get('location');
    if (!location || hops <= 0) throw new Error(`redirect ${res.status}`);
    // Re-gate the destination: the allowlist has to hold for every hop, not just the first.
    const next = gate(new URL(location, url).toString());
    if ('reason' in next) throw new Error(`redirect to ${next.reason}`);
    return probe(next.url, method, signal, hops - 1);
  }

  if (!res.ok) throw new Error(`status ${res.status}`);
  if (!isImage(res)) throw new Error(`content-type ${(res.headers.get('content-type') ?? 'none').slice(0, 40)}`);
  return true;
}

async function check(url: URL, signal: AbortSignal): Promise<boolean> {
  try {
    return await probe(url, 'HEAD', signal, MAX_REDIRECTS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A 404/410 is an answer, not a host quirk; only retry what HEAD may have broken.
    if (ABSENT_CODES.has(Number(message.replace('status ', '')))) throw err;
    if (signal.aborted) throw err;
    return await probe(url, 'GET', signal, MAX_REDIRECTS);
  }
}

function remember(key: string, value: Promise<boolean>): Promise<boolean> {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
  return value;
}

/**
 * True when `url` is an allowlisted https address that answers 2xx with an
 * `image/*` content type. Results (including the in-flight promise) are
 * memoised per process, so the same URL is fetched at most once.
 *
 * `signal` only cancels the caller's interest; the internal timeout bounds the
 * check either way. An aborted check is evicted rather than cached, so a
 * client disconnect cannot poison a URL for the rest of the process.
 */
export function verifyImage(url: unknown, signal?: AbortSignal): Promise<boolean> {
  if (typeof url !== 'string') return Promise.resolve(false);
  const key = url.trim();
  if (key === '') return Promise.resolve(false);

  const cached = cache.get(key);
  if (cached) return cached;

  const gated = gate(key);
  if ('reason' in gated) {
    // Rejected before any socket is opened: no network call is made at all.
    console.warn(`[cortex] image rejected (${gated.reason})`);
    return remember(key, Promise.resolve(false));
  }

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const linked = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const host = gated.url.hostname;

  const task = check(gated.url, linked).catch((err: unknown) => {
    const reason = timeout.aborted ? `timeout after ${TIMEOUT_MS} ms` : err instanceof Error ? err.message : String(err);
    if (signal?.aborted && !timeout.aborted) {
      cache.delete(key);
      return false;
    }
    console.warn(`[cortex] image rejected host=${host} (${reason})`);
    return false;
  });

  return remember(key, task);
}
