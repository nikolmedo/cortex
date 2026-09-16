import { GenkitError, z } from 'genkit';
import { ai, redactSecrets, resolveModelName, resolveModelRef } from '../infrastructure/geminiClient.js';
import { extractJSON } from '../infrastructure/parseScene.js';
import { sourcesFromGrounding, type GroundingSource } from '../infrastructure/grounding.js';
import { buildMainPrompt, buildSystemPrompt, type ResponseLang } from './prompt.js';
import { partialScene } from './partial.js';
import { SceneWireSchema, safeHttpsUrl, validateScene, type Scene, type ScenePreface } from '../domain/Scene.js';
import { CortexError } from '../domain/errors.js';
import type { ResearchResult } from './research.js';

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

export interface GenerateInput {
  query: string;
  lang: ResponseLang;
  /** Aborts the upstream Gemini request (client disconnect). */
  signal?: AbortSignal;
}

export interface SceneInput extends GenerateInput {
  /** The fast router's first read, when it arrived in time. */
  preface?: ScenePreface | null;
  /** Grounded notes and sources; null when the research stage failed. */
  research?: ResearchResult | null;
  /** Receives sanitized partial scenes while the answer streams. */
  onPartial?: (scene: Record<string, unknown>) => void;
}

const MAX_OUTPUT_TOKENS = 16384;
const TEMPERATURE = 0.3;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 75_000;
/** Minimum gap between partial events; one frame of reading, not one per token. */
const PARTIAL_THROTTLE_MS = 130;

/**
 * Combines the caller's signal with a timeout. Genkit forwards the combined
 * signal to fetch, so both a disconnect and the timeout cancel the HTTP call.
 */
export function linkedSignal(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; timedOut: () => boolean } {
  const timeout = AbortSignal.timeout(ms);
  return {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    timedOut: () => timeout.aborted,
  };
}

/** A 400 caused by the request shape (schema, tools, thinking), not by credentials. */
export function isBadRequest(err: unknown): err is GenkitError {
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

export function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactSecrets(message).split('\n')[0].slice(0, 400);
}

/** Problems are solved, not recalled: they get the deeper (slower) thinking budget. */
function thinkingLevel(input: SceneInput): 'LOW' | 'MEDIUM' {
  return input.preface?.intent === 'problem' ? 'MEDIUM' : 'LOW';
}

function requestOptions(input: SceneInput, shape: RequestProfile) {
  const grounded = (input.research?.sources.length ?? 0) > 0;
  return {
    model: resolveModelRef(),
    system: buildSystemPrompt(input.lang),
    prompt: buildMainPrompt(input.query, input.preface ?? null, grounded ? input.research!.brief : null),
    config: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      // Only as a fallback: with the Scene prompt and schema attached the model
      // never calls the tool (measured), so grounding runs in the research stage.
      // Passed straight to the API as tools: [{ google_search: {} }]; the
      // boolean form is rejected ("Invalid value at google_search").
      ...(grounded ? {} : { googleSearch: {} }),
      ...(shape.thinking ? { thinkingConfig: { thinkingLevel: thinkingLevel(input) } } : {}),
    },
    ...(shape.structuredOutput ? { output: { schema: SceneWireSchema } } : {}),
  };
}

/**
 * The hero image, resolved by one rule for partials and for the final scene:
 * the image the research stage found, otherwise the model's own. Both go through
 * https validation first, so an invalid model URL falls back to the research
 * image instead of blanking the hero, and the image cannot swap or vanish at the
 * moment the answer completes.
 */
function heroImage(input: SceneInput, candidate: unknown): string {
  return safeHttpsUrl(input.research?.imageUrl) || safeHttpsUrl(candidate);
}

/** Streams the answer, emitting throttled partial scenes, and returns the final payload. */
async function streamOnce(
  input: SceneInput,
  shape: RequestProfile,
  signal: AbortSignal,
  onPartial: (scene: Record<string, unknown>) => void,
  extra: Record<string, unknown>,
): Promise<GenerationResult> {
  const { stream, response } = ai.generateStream({ ...requestOptions(input, shape), abortSignal: signal });

  let lastAt = 0;
  let lastPayload = '';
  try {
    for await (const chunk of stream) {
      if (signal.aborted) break;
      const now = Date.now();
      if (now - lastAt < PARTIAL_THROTTLE_MS) continue;
      const scene = partialScene(chunk.output, extra);
      if (!scene) continue;
      scene.image_url = heroImage(input, scene.image_url);
      const payload = JSON.stringify(scene);
      if (payload === lastPayload) continue;
      lastAt = now;
      lastPayload = payload;
      onPartial(scene);
    }
  } catch (err) {
    // The failure surfaces again (with its data) on the response promise below.
    if (!isSchemaValidationError(err)) throw err;
  }

  const res = await response;
  const structured = shape.structuredOutput ? res.output : null;
  const raw = structured != null ? structured : extractJSON(res.text);
  return { raw, custom: res.custom, profile: shape };
}

async function generateOnce(
  input: SceneInput,
  shape: RequestProfile,
  signal: AbortSignal,
  extra: Record<string, unknown>,
): Promise<GenerationResult> {
  try {
    const canStream = Boolean(input.onPartial) && shape.structuredOutput;
    if (canStream) return await streamOnce(input, shape, signal, input.onPartial!, extra);

    const res = await ai.generate({ ...requestOptions(input, shape), abortSignal: signal });
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

async function generateWithFallback(input: SceneInput, signal: AbortSignal, extra: Record<string, unknown>): Promise<GenerationResult> {
  try {
    return await generateOnce(input, profile, signal, extra);
  } catch (err) {
    if (!isBadRequest(err)) throw err;
    const dropThinking = profile.thinking && /thinking/i.test(err.message);
    const next: RequestProfile = {
      structuredOutput: profile.structuredOutput && (dropThinking || !/schema|json/i.test(err.message)),
      thinking: profile.thinking && !dropThinking,
    };
    if (next.structuredOutput === profile.structuredOutput && next.thinking === profile.thinking) throw err;
    console.warn(`[cortex] request rejected (${firstLine(err)}); retrying with structuredOutput=${next.structuredOutput} thinking=${next.thinking}`);
    const result = await generateOnce(input, next, signal, extra);
    profile = next;
    return result;
  }
}

/** Sources of the research stage plus anything the main call grounded itself. */
function mergeSources(research: GroundingSource[], own: GroundingSource[]): GroundingSource[] {
  const out = [...research];
  const seen = new Set(out.map(s => s.title.toLowerCase()));
  for (const source of own) {
    if (seen.has(source.title.toLowerCase())) continue;
    seen.add(source.title.toLowerCase());
    out.push(source);
  }
  return out;
}

/** Main call: returns the validated scene or throws CortexError. Partials are emitted through `onPartial`. */
export async function generateScene(input: SceneInput): Promise<Scene> {
  const started = Date.now();
  const linked = linkedSignal(input.signal, GEMINI_TIMEOUT_MS);
  const researched = input.research?.sources ?? [];
  // The sources the research stage found are known before the answer is, so
  // every partial can carry them; the hero image is resolved by heroImage().
  const extra: Record<string, unknown> = researched.length > 0 ? { sources: researched } : {};

  let result: GenerationResult;
  try {
    result = await generateWithFallback(input, linked.signal, extra);
  } catch (err) {
    if (input.signal?.aborted) throw new CortexError('Request aborted by client', 'ABORTED');
    if (linked.timedOut()) throw new CortexError(`Upstream timeout after ${GEMINI_TIMEOUT_MS} ms`, 'GEMINI_ERROR');
    if (err instanceof CortexError) throw err;
    throw new CortexError(`Gemini request failed: ${firstLine(err)}`, 'GEMINI_ERROR');
  }

  const sources = mergeSources(researched, sourcesFromGrounding(result.custom));
  const base = result.raw !== null && typeof result.raw === 'object' ? (result.raw as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...base };
  if (sources.length > 0) merged.sources = sources;
  merged.image_url = heroImage(input, base.image_url);
  const scene = validateScene(merged);

  const kinds = scene.modules.map(m => m.kind).join(',');
  console.log(
    `[cortex] scene model=${resolveModelName()} ms=${Date.now() - started} lang=${input.lang} intent=${scene.intent} `
    + `layout=${scene.presentation.layout} mood=${scene.presentation.mood} modules=${scene.modules.length} kinds=${kinds} `
    + `sources=${scene.sources?.length ?? 0} thinking=${result.profile.thinking ? thinkingLevel(input) : 'off'} `
    + `structured=${result.profile.structuredOutput} streamed=${Boolean(input.onPartial)}`,
  );
  return scene;
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
  async ({ query, lang }): Promise<Scene> => generateScene({ query, lang }),
);
