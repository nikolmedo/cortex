import { config } from 'dotenv';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

config();

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});
