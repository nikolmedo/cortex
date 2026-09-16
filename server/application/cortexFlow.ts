import { GenkitError, z } from 'genkit';
import { ai, redactSecrets, resolveModelName, resolveModelRef } from '../infrastructure/geminiClient.js';
import { extractJSON } from '../infrastructure/parseScene.js';
import { sourcesFromGrounding, type GroundingSource } from '../infrastructure/grounding.js';
import { verifyImage } from '../infrastructure/verifyImage.js';
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

interface Hero {
  /**
   * Settles once the research image has been judged. Awaited after the model
   * request is already in flight, so it overlaps the answer instead of delaying
   * it — see streamOnce.
   */
  ready: Promise<void>;
  /**
   * The hero as known right now, for a partial. Never blocks: a candidate that
   * still needs checking is started in the background and picked up by a later
   * partial, because stalling the stream on a HEAD request is the very latency
   * this is meant to remove.
   */
  offer(candidate: unknown): string;
  /** The final value, once anything still in flight has settled. */
  settle(candidate: unknown): Promise<string>;
}

/**
 * Decides the hero image once per request, by the rule that was already here —
 * the image the research stage found, otherwise the model's own — with one
 * addition: a URL is adopted only after verifyImage confirms it really serves an
 * image. A plausible URL the model invented (the Kyoto fixture's Wikimedia 404)
 * used to reach the client and render as nothing at all.
 *
 * The value locks the moment one verifies and never changes after that, so every
 * partial and the final scene resolve to the same URL — an invariant a review
 * already flagged, and the reason verification cannot simply be re-run per
 * partial. The research image is known before the answer starts and its check is
 * warmed in the research stage, so it is normally already verified when the
 * first partial is built: the hero is present from the first frame rather than
 * appearing later and shifting the layout.
 */
function createHero(research: ResearchResult | null | undefined): Hero {
  const researchUrl = safeHttpsUrl(research?.imageUrl);
  let locked = '';
  /** The model's URL cannot win until the research image has been judged. */
  let researchSettled = researchUrl === '';
  const started = new Set<string>();
  const inFlight: Array<Promise<unknown>> = [];

  function start(url: string, isResearch: boolean): Promise<void> {
    started.add(url);
    const task = verifyImage(url).then(ok => {
      if (ok && locked === '') locked = url;
      if (isResearch) researchSettled = true;
    });
    inFlight.push(task);
    return task;
  }

  const ready = researchUrl === '' ? Promise.resolve() : start(researchUrl, true);

  function offer(candidate: unknown): string {
    if (locked !== '' || !researchSettled) return locked;
    const url = safeHttpsUrl(candidate);
    if (url !== '' && !started.has(url)) start(url, false);
    return locked;
  }

  return {
    ready,
    offer,
    async settle(candidate: unknown): Promise<string> {
      // Two rounds at most: the research image resolves in the first, which is
      // what allows the model's URL to be offered in the second.
      for (let round = 0; round < 2 && locked === ''; round += 1) {
        offer(candidate);
        await Promise.all(inFlight);
      }
      return locked;
    },
  };
}

/** Streams the answer, emitting throttled partial scenes, and returns the final payload. */
async function streamOnce(
  input: SceneInput,
  shape: RequestProfile,
  signal: AbortSignal,
  onPartial: (scene: Record<string, unknown>) => void,
  extra: Record<string, unknown>,
  hero: Hero,
): Promise<GenerationResult> {
  const { stream, response } = ai.generateStream({ ...requestOptions(input, shape), abortSignal: signal });

  // The request is already in flight, so this runs concurrently with the model's
  // first token rather than in series ahead of it, and verifyImage's own timeout
  // bounds it. Waiting here is what puts the research image on the FIRST partial
  // instead of a later one: arriving late is the layout shift this path exists
  // to remove. A retry re-awaits an already settled promise.
  await hero.ready;

  let lastAt = 0;
  let lastPayload = '';
  try {
    for await (const chunk of stream) {
      if (signal.aborted) break;
      const now = Date.now();
      if (now - lastAt < PARTIAL_THROTTLE_MS) continue;
      const scene = partialScene(chunk.output, extra);
      if (!scene) continue;
      scene.image_url = hero.offer(scene.image_url);
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
  hero: Hero,
): Promise<GenerationResult> {
  try {
    const canStream = Boolean(input.onPartial) && shape.structuredOutput;
    if (canStream) return await streamOnce(input, shape, signal, input.onPartial!, extra, hero);

    const res = await ai.generate({ ...requestOptions(input, shape), abortSignal: signal });
    const structured = shape.structuredOutput ? res.output : null;
    const raw = structured != null ? structured : extractJSON(res.text);
    return { raw, custom: res.custom, profile: shape };
  } catch (err) {
    if (!isSchemaValidationError(err)) throw err;
    const recovered = recoverDataFromValidationError(err.message);
    if (recovered !== undefined) return { raw: recovered, custom: undefined, profile: shape };
    // The wire schema asks for more than the model reliably gives: `facts` and
    // `items` are required there so a module can never come back as an empty
    // shell. That makes it a gate as well as a nudge, and a gate loses the whole
    // answer over one missing field. The reply is still there, so the gate is
    // dropped for one retry and the JSON is read out of the text instead, where
    // the lenient domain schema salvages whatever the model did write. The
    // process-wide profile is deliberately left alone: structured output is
    // still the right first attempt for the next question.
    if (!shape.structuredOutput) {
      throw new CortexError('Structured output did not match the Scene wire schema', 'PARSE_FAILURE');
    }
    console.warn(`[cortex] structured output failed validation (${firstLine(err)}); retrying once as raw JSON`);
    return await generateOnce(input, { ...shape, structuredOutput: false }, signal, extra, hero);
  }
}

async function generateWithFallback(input: SceneInput, signal: AbortSignal, extra: Record<string, unknown>, hero: Hero): Promise<GenerationResult> {
  try {
    return await generateOnce(input, profile, signal, extra, hero);
  } catch (err) {
    if (!isBadRequest(err)) throw err;
    const dropThinking = profile.thinking && /thinking/i.test(err.message);
    const next: RequestProfile = {
      structuredOutput: profile.structuredOutput && (dropThinking || !/schema|json/i.test(err.message)),
      thinking: profile.thinking && !dropThinking,
    };
    if (next.structuredOutput === profile.structuredOutput && next.thinking === profile.thinking) throw err;
    console.warn(`[cortex] request rejected (${firstLine(err)}); retrying with structuredOutput=${next.structuredOutput} thinking=${next.thinking}`);
    // The same Hero as the first attempt: a retry must not blank a hero an
    // earlier attempt already streamed.
    const result = await generateOnce(input, next, signal, extra, hero);
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
  // every partial can carry them; the hero image is resolved by the Hero below.
  const extra: Record<string, unknown> = researched.length > 0 ? { sources: researched } : {};
  // Created before the request goes out, so the research image is verified
  // concurrently with the model call rather than in series ahead of it.
  const hero = createHero(input.research);

  let result: GenerationResult;
  try {
    result = await generateWithFallback(input, linked.signal, extra, hero);
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
  merged.image_url = await hero.settle(base.image_url);
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
