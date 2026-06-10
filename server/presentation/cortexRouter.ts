import { Router } from 'express';
import { cortexFlow } from '../application/cortexFlow.js';
import { CortexError } from '../domain/errors.js';

export const cortexRouter = Router();

cortexRouter.post('/cortex', async (req, res) => {
  const { query, lang } = req.body as { query?: unknown; lang?: unknown };

  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'query must be a non-empty string', code: 'INVALID_INPUT' });
    return;
  }

  const responseLang = lang === 'es' ? 'es' : 'en';

  try {
    const data = await cortexFlow({ query: query.trim(), lang: responseLang });
    res.json(data);
  } catch (err) {
    if (err instanceof CortexError) {
      res.status(422).json({ error: err.message, code: err.code });
    } else {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message, code: 'GEMINI_ERROR' });
    }
  }
});
