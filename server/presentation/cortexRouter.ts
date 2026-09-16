import { Router, type Request, type Response } from 'express';
import { generateScene } from '../application/cortexFlow.js';
import { runResearch } from '../application/research.js';
import { runCortexStream, type StreamEvent } from '../application/cortexStream.js';
import type { ResponseLang } from '../application/prompt.js';
import { resolveModelName, resolvePrefaceModelName } from '../infrastructure/geminiClient.js';
import { fixturesEnabled } from '../infrastructure/fixtures.js';
import { CortexError, type ErrorCode } from '../domain/errors.js';

export const MAX_QUERY_LENGTH = 2000;
const HEARTBEAT_MS = 15_000;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  PARSE_FAILURE: 422,
  VALIDATION_ERROR: 422,
  GEMINI_ERROR: 502,
  ABORTED: 499,
};

type ParsedInput = { ok: true; query: string; lang: ResponseLang } | { ok: false; error: string };

function parseInput(body: unknown): ParsedInput {
  const { query, lang } = (body ?? {}) as { query?: unknown; lang?: unknown };
  if (typeof query !== 'string' || query.trim().length === 0) {
    return { ok: false, error: 'query must be a non-empty string' };
  }
  const trimmed = query.trim();
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `query must be at most ${MAX_QUERY_LENGTH} characters` };
  }
  return { ok: true, query: trimmed, lang: lang === 'es' ? 'es' : 'en' };
}

/** Aborts when the client goes away before the response finished. */
function disconnectSignal(res: Response): { signal: AbortSignal; finish: () => void } {
  const controller = new AbortController();
  let finished = false;
  res.on('close', () => {
    if (!finished) controller.abort();
  });
  return { signal: controller.signal, finish: () => { finished = true; } };
}

export const cortexRouter = Router();

cortexRouter.get('/health', (_req, res) => {
  res.json({ ok: true, model: resolveModelName(), prefaceModel: resolvePrefaceModelName(), fixtures: fixturesEnabled() });
});

cortexRouter.post('/cortex', async (req: Request, res: Response) => {
  const input = parseInput(req.body);
  if (!input.ok) {
    res.status(400).json({ error: input.error, code: 'INVALID_INPUT' });
    return;
  }

  const connection = disconnectSignal(res);
  try {
    // Same grounded first stage as the stream; without it the answer has no sources.
    const research = await runResearch({ query: input.query, lang: input.lang, signal: connection.signal });
    const scene = await generateScene({ query: input.query, lang: input.lang, signal: connection.signal, research });
    connection.finish();
    res.json(scene);
  } catch (err) {
    connection.finish();
    if (res.writableEnded || connection.signal.aborted) return;
    if (err instanceof CortexError) {
      const status = STATUS_BY_CODE[err.code] ?? 500;
      if (status >= 500) console.error(`[cortex] ${err.code}: ${err.message}`);
      else if (err.code !== 'INVALID_INPUT') console.warn(`[cortex] ${err.code}: ${err.message}`);
      res.status(status).json({
        error: status >= 500 ? 'Upstream model request failed' : err.message,
        code: err.code,
      });
      return;
    }
    console.error('[cortex] unexpected error', err);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * Server-sent events over a POST response. Invalid input is rejected with a
 * JSON 400 before the stream opens. Comment heartbeats keep idle proxies and
 * the client idle timer alive while the grounded call runs.
 */
cortexRouter.post('/cortex/stream', async (req: Request, res: Response) => {
  const input = parseInput(req.body);
  if (!input.ok) {
    res.status(400).json({ error: input.error, code: 'INVALID_INPUT' });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const connection = disconnectSignal(res);
  const write = (chunk: string) => {
    if (!connection.signal.aborted && !res.writableEnded) res.write(chunk);
  };
  const emit = (e: StreamEvent) => write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
  const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);

  try {
    await runCortexStream({ query: input.query, lang: input.lang }, { emit, signal: connection.signal });
  } catch (err) {
    console.error('[cortex] unexpected stream error', err);
    emit({ event: 'error', data: { code: 'INTERNAL_ERROR' } });
    emit({ event: 'done', data: { prefaceMs: null, researchMs: null, firstPartialMs: null, sceneMs: null, sources: 0 } });
  } finally {
    clearInterval(heartbeat);
    connection.finish();
    if (!res.writableEnded) res.end();
  }
});
