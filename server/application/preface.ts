import { ai, resolvePrefaceModelName, resolvePrefaceModelRef } from '../infrastructure/geminiClient.js';
import { extractJSON } from '../infrastructure/parseScene.js';
import { DEFAULT_PALETTE, PrefaceWireSchema, validatePreface, type ScenePreface } from '../domain/Scene.js';
import { buildPrefacePrompt } from './prompt.js';
import {
  firstLine,
  isBadRequest,
  isSchemaValidationError,
  linkedSignal,
  recoverDataFromValidationError,
  type GenerateInput,
} from './cortexFlow.js';

type ThinkingLevel = 'MINIMAL' | 'LOW';

/** Lowest thinking level the preface model accepted; degrades once per process on rejection. */
let thinkingLevel: ThinkingLevel | null = 'MINIMAL';

const PREFACE_TIMEOUT_MS = Number(process.env.CORTEX_PREFACE_TIMEOUT_MS) || 8_000;
const PREFACE_MAX_OUTPUT_TOKENS = 1024;

async function requestPreface(input: GenerateInput, signal: AbortSignal): Promise<unknown> {
  for (;;) {
    const level = thinkingLevel;
    try {
      const res = await ai.generate({
        model: resolvePrefaceModelRef(),
        system: buildPrefacePrompt(input.lang),
        prompt: input.query,
        config: {
          temperature: 0.2,
          maxOutputTokens: PREFACE_MAX_OUTPUT_TOKENS,
          ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
        },
        output: { schema: PrefaceWireSchema },
        abortSignal: signal,
      });
      return res.output ?? extractJSON(res.text);
    } catch (err) {
      if (isSchemaValidationError(err)) return recoverDataFromValidationError(err.message);
      if (level !== null && isBadRequest(err) && /thinking/i.test(err.message)) {
        thinkingLevel = level === 'MINIMAL' ? 'LOW' : null;
        console.warn(`[cortex] preface rejected thinkingLevel=${level} (${firstLine(err)}); retrying with ${thinkingLevel ?? 'model default'}`);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Fast, ungrounded first read of the question. Never throws: any failure,
 * timeout or abort resolves to null so the main request is unaffected.
 */
export async function generatePreface(input: GenerateInput): Promise<ScenePreface | null> {
  const started = Date.now();
  const linked = linkedSignal(input.signal, PREFACE_TIMEOUT_MS);
  try {
    const raw = await requestPreface(input, linked.signal);
    const preface = validatePreface(raw);
    if (preface && preface.palette.primary === DEFAULT_PALETTE.primary
      && preface.palette.secondary === DEFAULT_PALETTE.secondary && preface.palette.accent === DEFAULT_PALETTE.accent) {
      const rawPalette = raw && typeof raw === 'object' ? (raw as { palette?: unknown }).palette : undefined;
      console.warn(`[cortex] preface palette fell back to default; model sent ${JSON.stringify(rawPalette ?? null).slice(0, 200)}`);
    }
    console.log(
      `[cortex] preface model=${resolvePrefaceModelName()} ms=${Date.now() - started} thinking=${thinkingLevel ?? 'default'} `
      + `intent=${preface?.intent ?? '-'} layout=${preface?.layout ?? '-'}`,
    );
    return preface;
  } catch (err) {
    if (!input.signal?.aborted) {
      const reason = linked.timedOut() ? `timeout after ${PREFACE_TIMEOUT_MS} ms` : firstLine(err);
      console.warn(`[cortex] preface skipped ms=${Date.now() - started} (${reason})`);
    }
    return null;
  }
}
