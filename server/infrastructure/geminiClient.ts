import { config } from 'dotenv';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

config();

export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** Bare model name, overridable through GEMINI_MODEL. */
export function resolveModelName(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_MODEL;
}

/** Model reference in the form the googleAI plugin resolves dynamically. */
export function resolveModelRef(): string {
  return `googleai/${resolveModelName()}`;
}

/** Google error messages can echo the request URL, including the API key. */
export function redactSecrets(message: string): string {
  return message.replace(/key=[^&\s]+/gi, 'key=REDACTED');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});
