import 'dotenv/config';
import express from 'express';
import { cortexRouter } from './presentation/cortexRouter.js';
import { resolveModelName } from './infrastructure/geminiClient.js';

if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use('/api', cortexRouter);

const PORT = Number(process.env.PORT ?? 3001);
const server = app.listen(PORT, () => {
  console.log(`Cortex server running on http://localhost:${PORT} (model: ${resolveModelName()})`);
});
server.requestTimeout = 120_000;
