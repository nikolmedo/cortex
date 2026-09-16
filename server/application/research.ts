import { ai, resolveResearchModelName, resolveResearchModelRef } from '../infrastructure/geminiClient.js';
import { sourcesFromGrounding, type GroundingSource } from '../infrastructure/grounding.js';
import { safeHttpsUrl } from '../domain/Scene.js';
import { firstLine, linkedSignal, type GenerateInput } from './cortexFlow.js';
import { buildResearchPrompt } from './prompt.js';

export interface ResearchResult {
  /** Plain-text brief handed to the main call. Empty when the model searched nothing useful. */
  brief: string;
  sources: GroundingSource[];
  /** Direct https image URL for entity subjects, when a result showed one. */
  imageUrl: string;
  searches: number;
}

const RESEARCH_TIMEOUT_MS = Number(process.env.CORTEX_RESEARCH_TIMEOUT_MS) || 15_000;
const RESEARCH_MAX_OUTPUT_TOKENS = 2048;
const BRIEF_MAX_CHARS = 6000;

function countSearches(custom: unknown): number {
  const queries = (custom as { candidates?: Array<{ groundingMetadata?: { webSearchQueries?: unknown } }> } | undefined)
    ?.candidates?.[0]?.groundingMetadata?.webSearchQueries;
  return Array.isArray(queries) ? queries.length : 0;
}

/** Pulls the optional trailing "Image: <url>" line out of the brief. */
function splitImage(text: string): { brief: string; imageUrl: string } {
  const match = text.match(/^\s*Image:\s*(\S+)\s*$/m);
  if (!match) return { brief: text, imageUrl: '' };
  return { brief: text.replace(match[0], '').trim(), imageUrl: safeHttpsUrl(match[1]) };
}

/**
 * Grounded research stage. `gemini-3.8-flash` reliably ignores the search tool
 * once the full Scene prompt or the Scene schema is attached (measured: zero
 * searches on every configuration tried), so the search runs here instead: a
 * short prompt, plain text, no schema. Never throws; failure returns null and
 * the main call keeps the search tool attached as a nominal fallback, which in
 * practice means the answer is written ungrounded (with no sources).
 */
export async function runResearch(input: GenerateInput): Promise<ResearchResult | null> {
  const started = Date.now();
  const linked = linkedSignal(input.signal, RESEARCH_TIMEOUT_MS);
  try {
    const res = await ai.generate({
      model: resolveResearchModelRef(),
      system: buildResearchPrompt(),
      prompt: input.query,
      config: {
        temperature: 0.2,
        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
        googleSearch: {},
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
      },
      abortSignal: linked.signal,
    });

    const { brief, imageUrl } = splitImage(res.text.trim());
    const result: ResearchResult = {
      brief: brief.slice(0, BRIEF_MAX_CHARS),
      sources: sourcesFromGrounding(res.custom),
      imageUrl,
      searches: countSearches(res.custom),
    };
    console.log(
      `[cortex] research model=${resolveResearchModelName()} ms=${Date.now() - started} `
      + `searches=${result.searches} sources=${result.sources.length} chars=${result.brief.length}`,
    );
    return result;
  } catch (err) {
    if (!input.signal?.aborted) {
      const reason = linked.timedOut() ? `timeout after ${RESEARCH_TIMEOUT_MS} ms` : firstLine(err);
      console.warn(`[cortex] research skipped ms=${Date.now() - started} (${reason})`);
    }
    return null;
  }
}
