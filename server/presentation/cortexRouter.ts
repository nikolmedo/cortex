import { Router } from 'express';
import { cortexFlow } from '../application/cortexFlow.js';
import { resolveModelName } from '../infrastructure/geminiClient.js';
import { CortexError, type ErrorCode } from '../domain/errors.js';

export const MAX_QUERY_LENGTH = 200;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  PARSE_FAILURE: 422,
  VALIDATION_ERROR: 422,
  GEMINI_ERROR: 502,
};

export const cortexRouter = Router();

cortexRouter.get('/health', (_req, res) => {
  res.json({ ok: true, model: resolveModelName() });
});

cortexRouter.post('/cortex', async (req, res) => {
  const { query, lang } = (req.body ?? {}) as { query?: unknown; lang?: unknown };

  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'query must be a non-empty string', code: 'INVALID_INPUT' });
    return;
  }
  const trimmed = query.trim();
  if (trimmed.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `query must be at most ${MAX_QUERY_LENGTH} characters`, code: 'INVALID_INPUT' });
    return;
  }

  const responseLang = lang === 'es' ? 'es' : 'en';

  try {
    const scene = await cortexFlow({ query: trimmed, lang: responseLang });
    res.json(scene);
  } catch (err) {
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
