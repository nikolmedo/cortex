import { sanitizePreface, sanitizeScene, type Scene, type ScenePreface } from '../domain/Scene';
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

/** Max wait for the first byte of the stream (events or heartbeats). */
export const FIRST_EVENT_TIMEOUT_MS = 20_000;
/** Max silence between stream chunks; the server sends a heartbeat every 15 s. */
export const IDLE_TIMEOUT_MS = 45_000;

export const MAX_QUERY_LENGTH = 2000;

export interface ResearchInfo {
  sources: number;
  searches: number;
}

export interface StreamOptions {
  signal?: AbortSignal;
  /** Called at most once, before the scene, with the sanitized preface. */
  onPreface?: (preface: ScenePreface) => void;
  /** Called once when the grounded research stage reports back. */
  onResearch?: (info: ResearchInfo) => void;
  /** Called for every partial scene; each one supersedes the previous. */
  onPartial?: (scene: Scene) => void;
}

interface SseFrame {
  event: string;
  data: string;
}

function detailOf(err: unknown): string | undefined {
  return err instanceof Error ? err.message : undefined;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function parseFrame(frame: string): SseFrame | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch (err) {
    throw new CortexApiError('error.parse', detailOf(err));
  }
}

/**
 * Streams one Cortex answer over SSE (POST + ReadableStream). Resolves with the
 * sanitized final scene; rejects with CortexApiError, or with an AbortError
 * DOMException when the caller's signal aborts.
 */
export async function streamCortex(query: string, lang: Locale, options: StreamOptions = {}): Promise<Scene> {
  const { signal, onPreface, onResearch, onPartial } = options;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const internal = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      internal.abort();
    }, ms);
  };
  const forwardAbort = () => internal.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });
  arm(FIRST_EVENT_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch('/api/cortex/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ query, lang }),
        signal: internal.signal,
      });
    } catch (err) {
      if (internal.signal.aborted) throw err;
      throw new CortexApiError('error.network', detailOf(err));
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      throw new CortexApiError(CODE_KEYS[body.code ?? ''] ?? 'error.unknown', body.error);
    }
    if (!res.body) throw new CortexApiError('error.network', 'Response has no body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let scene: Scene | null = null;
    let prefaceSeen = false;

    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (internal.signal.aborted) throw err;
        throw new CortexApiError('error.network', detailOf(err));
      }
      if (chunk.done) break;
      arm(IDLE_TIMEOUT_MS);
      buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        if (!frame) continue;

        switch (frame.event) {
          case 'preface': {
            if (prefaceSeen || scene) break;
            prefaceSeen = true;
            const preface = sanitizePreface(parseJson(frame.data));
            if (preface) onPreface?.(preface);
            break;
          }
          case 'research': {
            const payload = parseJson(frame.data) as { sources?: unknown; searches?: unknown } | null;
            onResearch?.({
              sources: typeof payload?.sources === 'number' ? payload.sources : 0,
              searches: typeof payload?.searches === 'number' ? payload.searches : 0,
            });
            break;
          }
          case 'partial': {
            if (scene) break;
            // A partial that does not sanitize is simply skipped; the next one supersedes it.
            try {
              onPartial?.(sanitizeScene(parseJson(frame.data)));
            } catch {
              break;
            }
            break;
          }
          case 'scene':
            try {
              scene = sanitizeScene(parseJson(frame.data));
            } catch (err) {
              if (err instanceof CortexApiError) throw err;
              throw new CortexApiError('error.validation', detailOf(err));
            }
            break;
          case 'error': {
            const payload = parseJson(frame.data) as { code?: unknown } | null;
            const code = typeof payload?.code === 'string' ? payload.code : '';
            throw new CortexApiError(CODE_KEYS[code] ?? 'error.unknown', code || undefined);
          }
          case 'done':
            if (scene) return scene;
            throw new CortexApiError('error.unknown', 'Stream finished without a scene');
          default:
            break;
        }
      }
    }

    if (scene) return scene;
    throw new CortexApiError('error.network', 'Stream closed before a scene arrived');
  } catch (err) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (timedOut) throw new CortexApiError('error.timeout', detailOf(err));
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
    internal.abort();
  }
}
