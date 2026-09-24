import { ai, resolvePrefaceModelRef } from '../infrastructure/geminiClient.js';
import { extractJSON } from '../infrastructure/parseScene.js';
import { firstLine, isBadRequest, isSchemaValidationError, linkedSignal, recoverDataFromValidationError } from './cortexFlow.js';
import { TrendingWireSchema, type QuestionModel } from './trending.js';

type ThinkingLevel = 'MINIMAL' | 'LOW';

/** Same fast model and thinking negotiation as the preface; degrades once per process on rejection. */
let thinkingLevel: ThinkingLevel | null = 'MINIMAL';

const TRENDING_MODEL_TIMEOUT_MS = 10_000;
const TRENDING_MAX_OUTPUT_TOKENS = 1024;

export const geminiQuestionModel: QuestionModel = async ({ system, prompt, signal }) => {
  const linked = linkedSignal(signal, TRENDING_MODEL_TIMEOUT_MS);
  for (;;) {
    const level = thinkingLevel;
    try {
      const res = await ai.generate({
        model: resolvePrefaceModelRef(),
        system,
        prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: TRENDING_MAX_OUTPUT_TOKENS,
          ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
        },
        output: { schema: TrendingWireSchema },
        abortSignal: linked.signal,
      });
      return res.output ?? extractJSON(res.text);
    } catch (err) {
      if (isSchemaValidationError(err)) return recoverDataFromValidationError(err.message);
      if (level !== null && isBadRequest(err) && /thinking/i.test(err.message)) {
        thinkingLevel = level === 'MINIMAL' ? 'LOW' : null;
        console.warn(`[cortex] trending rejected thinkingLevel=${level} (${firstLine(err)}); retrying with ${thinkingLevel ?? 'model default'}`);
        continue;
      }
      if (linked.timedOut()) throw new Error(`model timeout after ${TRENDING_MODEL_TIMEOUT_MS} ms`);
      throw err;
    }
  }
};
