import { GenkitError, z } from 'genkit';
import { ai, redactSecrets, resolveModelName, resolveModelRef } from '../infrastructure/geminiClient.js';
import { extractJSON } from '../infrastructure/parseScene.js';
import { sourcesFromGrounding } from '../infrastructure/grounding.js';
import { buildSystemPrompt, type ResponseLang } from './prompt.js';
import { SceneWireSchema, validateScene, type Scene } from '../domain/Scene.js';
import { CortexError } from '../domain/errors.js';

/**
 * Request shape negotiated with the API at runtime. Starts with the richest
 * form (structured output + low thinking) and degrades once per process when
 * the API rejects a feature, so later requests skip the failing attempt.
 */
interface RequestProfile {
  structuredOutput: boolean;
  thinking: boolean;
}

let profile: RequestProfile = { structuredOutput: true, thinking: true };

interface GenerationResult {
  raw: unknown;
  custom: unknown;
  profile: RequestProfile;
}

const MAX_OUTPUT_TOKENS = 16384;
const TEMPERATURE = 0.3;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 75_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CortexError('Upstream timeout', 'GEMINI_ERROR')), ms);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/** A 400 caused by the request shape (schema, tools, thinking), not by credentials. */
function isBadRequest(err: unknown): err is GenkitError {
  return err instanceof GenkitError
    && err.status === 'INVALID_ARGUMENT'
    && /400 Bad Request/.test(err.message)
    && !/API_KEY_INVALID|API key not valid/i.test(err.message);
}

/** GenkitError prefixes its status: the message reads "INVALID_ARGUMENT: Schema validation failed. ...". */
export function isSchemaValidationError(err: unknown): err is GenkitError {
  return err instanceof GenkitError && err.status === 'INVALID_ARGUMENT' && err.message.includes('Schema validation failed');
}

/**
 * Genkit validates structured output against the wire schema and throws when
 * a field is missing. The lenient domain schema can still salvage the object,
 * which the error only carries inside its message.
 */
export function recoverDataFromValidationError(message: string): unknown {
  const start = message.indexOf('Provided data:');
  const end = message.indexOf('Required JSON schema:');
  if (start === -1 || end === -1 || end <= start) return undefined;
  const block = message.slice(start + 'Provided data:'.length, end);
  try {
    return extractJSON(block);
  } catch {
    return undefined;
  }
}

async function generateOnce(query: string, lang: ResponseLang, shape: RequestProfile): Promise<GenerationResult> {
  try {
    const res = await withTimeout(ai.generate({
      model: resolveModelRef(),
      system: buildSystemPrompt(lang),
      prompt: query,
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        // Passed straight to the API as tools: [{ google_search: {} }]; the
        // boolean form is rejected ("Invalid value at google_search").
        googleSearch: {},
        ...(shape.thinking ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
      },
      ...(shape.structuredOutput ? { output: { schema: SceneWireSchema } } : {}),
    }), GEMINI_TIMEOUT_MS);

    const structured = shape.structuredOutput ? res.output : null;
    const raw = structured != null ? structured : extractJSON(res.text);
    return { raw, custom: res.custom, profile: shape };
  } catch (err) {
    if (isSchemaValidationError(err)) {
      const recovered = recoverDataFromValidationError(err.message);
      if (recovered !== undefined) return { raw: recovered, custom: undefined, profile: shape };
      throw new CortexError('Structured output did not match the Scene wire schema', 'PARSE_FAILURE');
    }
    throw err;
  }
}

async function generateWithFallback(query: string, lang: ResponseLang): Promise<GenerationResult> {
  try {
    return await generateOnce(query, lang, profile);
  } catch (err) {
    if (!isBadRequest(err)) throw err;
    const firstLine = redactSecrets(err.message).split('\n')[0];
    const dropThinking = profile.thinking && /thinking/i.test(err.message);
    const next: RequestProfile = {
      structuredOutput: profile.structuredOutput && (dropThinking || !/schema|json/i.test(err.message)),
      thinking: profile.thinking && !dropThinking,
    };
    if (next.structuredOutput === profile.structuredOutput && next.thinking === profile.thinking) throw err;
    console.warn(`[cortex] request rejected (${firstLine}); retrying with structuredOutput=${next.structuredOutput} thinking=${next.thinking}`);
    const result = await generateOnce(query, lang, next);
    profile = next;
    return result;
  }
}

export const cortexFlow = ai.defineFlow(
  {
    name: 'cortexFlow',
    inputSchema: z.object({
      query: z.string().min(1),
      lang: z.enum(['en', 'es']).default('en'),
    }),
    // outputSchema omitted on purpose: the strict SceneSchema sanitises and the
    // flow returns its parsed value directly.
  },
  async ({ query, lang }): Promise<Scene> => {
    const started = Date.now();
    let result: GenerationResult;
    try {
      result = await generateWithFallback(query, lang);
    } catch (err) {
      if (err instanceof CortexError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new CortexError(`Gemini request failed: ${redactSecrets(message).split('\n')[0].slice(0, 400)}`, 'GEMINI_ERROR');
    }

    const sources = sourcesFromGrounding(result.custom);
    const base = result.raw !== null && typeof result.raw === 'object' ? (result.raw as Record<string, unknown>) : {};
    const scene = validateScene(sources.length > 0 ? { ...base, sources } : base);

    const kinds = scene.graph.map(c => c.kind).join(',');
    console.log(
      `[cortex] model=${resolveModelName()} ms=${Date.now() - started} lang=${lang} archetype=${scene.presentation.archetype} `
      + `mood=${scene.presentation.mood} categories=${scene.graph.length} kinds=${kinds} sources=${scene.sources?.length ?? 0} `
      + `structured=${result.profile.structuredOutput} thinking=${result.profile.thinking}`,
    );
    return scene;
  },
);
