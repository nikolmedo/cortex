import { sanitizeScene, type Scene } from '../domain/Scene';
import type { Locale, TranslationKey } from '../i18n/translations';

export type CortexErrorKey = Extract<TranslationKey, `error.${string}`>;

export class CortexApiError extends Error {
  constructor(public readonly key: CortexErrorKey, detail?: string) {
    super(detail ?? key);
    this.name = 'CortexApiError';
  }
}

const CODE_KEYS: Record<string, CortexErrorKey> = {
  INVALID_INPUT: 'error.validation',
  PARSE_FAILURE: 'error.parse',
  VALIDATION_ERROR: 'error.validation',
  GEMINI_ERROR: 'error.upstream',
};

function detailOf(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

const REQUEST_TIMEOUT_MS = 90_000;

function abortName(err: unknown): string {
  return err instanceof DOMException ? err.name : '';
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal.any === 'function') {
    const timeout = AbortSignal.timeout(timeoutMs);
    return { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cleanup: () => {} };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    ctrl.abort(typeof DOMException === 'function' ? new DOMException('Timeout', 'TimeoutError') : undefined);
  }, timeoutMs);
  if (signal?.aborted) ctrl.abort(signal.reason);
  else signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
}

export async function callCortexAPI(query: string, lang: Locale = 'en', signal?: AbortSignal): Promise<Scene> {
  const combined = combineSignals(signal, REQUEST_TIMEOUT_MS);
  try {
    return await requestScene(query, lang, combined.signal);
  } finally {
    combined.cleanup();
  }
}

async function requestScene(query: string, lang: Locale, signal: AbortSignal): Promise<Scene> {
  let res: Response;
  try {
    res = await fetch('/api/cortex', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, lang }),
      signal,
    });
  } catch (err) {
    const name = abortName(err);
    if (name === 'AbortError') throw err;
    if (name === 'TimeoutError') throw new CortexApiError('error.timeout', detailOf(err));
    throw new CortexApiError('error.network', detailOf(err));
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new CortexApiError(CODE_KEYS[body.code ?? ''] ?? 'error.unknown', body.error);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw new CortexApiError('error.parse', detailOf(err));
  }
  try {
    return sanitizeScene(payload);
  } catch (err) {
    throw new CortexApiError('error.validation', detailOf(err));
  }
}
