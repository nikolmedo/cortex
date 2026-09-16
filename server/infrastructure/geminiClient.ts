import { config } from 'dotenv';
import { genkit, type ModelArgument } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

config();

/**
 * Model references are memoised: resolving the same model name from two
 * requests at once made the plugin register it twice ("already has an entry in
 * the registry. Overwriting"), and the losing request failed with a bare
 * "fetch failed". The preface and the research stage start together, so this
 * matters.
 */
const refs = new Map<string, ModelArgument>();

function modelRef(name: string): ModelArgument {
  const cached = refs.get(name);
  if (cached) return cached;
  const ref = googleAI.model(name) as ModelArgument;
  refs.set(name, ref);
  return ref;
}

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_PREFACE_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_RESEARCH_MODEL = 'gemini-3.5-flash-lite';

/** Bare model name, overridable through GEMINI_MODEL. */
export function resolveModelName(): string {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_MODEL;
}

/** Model reference the googleAI plugin resolves, created once per model name. */
export function resolveModelRef(): ModelArgument {
  return modelRef(resolveModelName());
}

/** Bare name of the fast preface model, overridable through GEMINI_PREFACE_MODEL. */
export function resolvePrefaceModelName(): string {
  const fromEnv = process.env.GEMINI_PREFACE_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_PREFACE_MODEL;
}

export function resolvePrefaceModelRef(): ModelArgument {
  return modelRef(resolvePrefaceModelName());
}

/** Bare name of the grounded research model, overridable through GEMINI_RESEARCH_MODEL. */
export function resolveResearchModelName(): string {
  const fromEnv = process.env.GEMINI_RESEARCH_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_RESEARCH_MODEL;
}

export function resolveResearchModelRef(): ModelArgument {
  return modelRef(resolveResearchModelName());
}

/** Google error messages can echo the request URL, including the API key. */
export function redactSecrets(message: string): string {
  return message.replace(/key=[^&\s]+/gi, 'key=REDACTED');
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});
