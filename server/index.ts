import 'dotenv/config';
import express from 'express';
import { cortexRouter } from './presentation/cortexRouter.js';
import { resolveModelName, resolvePrefaceModelName } from './infrastructure/geminiClient.js';
import { captureDir, fixturesEnabled, FIXTURE_TRENDING } from './infrastructure/fixtures.js';
import { fetchTrends } from './infrastructure/googleTrends.js';
import { createTrendingService, type TrendingService } from './application/trending.js';
import { geminiQuestionModel } from './application/trendingModel.js';
import { createTrendingRouter } from './presentation/trendingRouter.js';

if (!process.env.GEMINI_API_KEY && !fixturesEnabled()) {
  console.error('Error: GEMINI_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use('/api', cortexRouter);

const trending: TrendingService = fixturesEnabled()
  ? { get: async (_geo, lang) => ({ questions: [...FIXTURE_TRENDING[lang]], generatedAt: new Date(0).toISOString() }) }
  : createTrendingService({ loadTrends: geo => fetchTrends(geo), model: geminiQuestionModel });
app.use('/api', createTrendingRouter(trending));

const PORT = Number(process.env.PORT ?? 3001);
const server = app.listen(PORT, () => {
  console.log(`Cortex server running on http://localhost:${PORT} (model: ${resolveModelName()}, preface: ${resolvePrefaceModelName()})`);
  if (fixturesEnabled()) console.log('[cortex] dev fixtures mode: /api/cortex/stream replays server/fixtures without calling Gemini');
  const capture = captureDir();
  if (capture) console.log(`[cortex] capturing stream results to ${capture}`);
});
server.requestTimeout = 120_000;
