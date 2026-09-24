import { Router, type Request, type Response } from 'express';
import type { ResponseLang } from '../application/prompt.js';
import type { TrendingService } from '../application/trending.js';

export const DEFAULT_GEO = 'US';

export interface TrendingParams {
  lang: ResponseLang;
  geo: string;
}

function single(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Unknown languages fall back to en; anything but two uppercase ASCII letters falls back to US. */
export function parseTrendingParams(query: unknown): TrendingParams {
  const q = (query ?? {}) as Record<string, unknown>;
  const lang = single(q.lang) === 'es' ? 'es' : 'en';
  const geo = single(q.geo);
  return { lang, geo: geo && /^[A-Z]{2}$/.test(geo) ? geo : DEFAULT_GEO };
}

export function createTrendingRouter(service: TrendingService): Router {
  const router = Router();
  router.get('/trending', async (req: Request, res: Response) => {
    const { lang, geo } = parseTrendingParams(req.query);
    try {
      const result = await service.get(geo, lang);
      // An empty list is the client's cue to keep its static examples; never pin it in caches.
      res.setHeader('Cache-Control', result.questions.length > 0 ? 'public, max-age=600' : 'no-store');
      res.json({ questions: result.questions, geo, generatedAt: result.generatedAt });
    } catch (err) {
      console.error('[cortex] unexpected trending error', err);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ questions: [], geo, generatedAt: null });
    }
  });
  return router;
}
