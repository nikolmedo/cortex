import { ai, resolveModelName, resolveModelRef } from '../infrastructure/geminiClient.js';
import { sanitizeAppletHtml, type AppletBrief } from '../domain/Scene.js';
import { firstLine, isBadRequest, linkedSignal } from './cortexFlow.js';
import { buildAppletPrompt, buildAppletRequest } from './appletPrompt.js';
import type { ResponseLang } from './prompt.js';

export interface AppletInput {
  query: string;
  lang: ResponseLang;
  applet: AppletBrief;
  /** Aborts the model call (client disconnect). */
  signal?: AbortSignal;
}

export interface AppletRequest {
  system: string;
  prompt: string;
  signal: AbortSignal;
}

export interface AppletReply {
  text: string;
  /** Genkit's normalised finish reason ('stop', 'length', 'blocked', ...). */
  finishReason?: string;
}

/** One plain-text model call. Injected so tests never reach Gemini. */
export type AppletModel = (request: AppletRequest) => Promise<AppletReply>;

const APPLET_TIMEOUT_MS = Number(process.env.CORTEX_APPLET_TIMEOUT_MS) || 45_000;
/** About 32 000 characters of markup plus headroom; LIMITS.appletHtml is the real cap. */
const APPLET_MAX_OUTPUT_TOKENS = 16384;

/** Finish reasons that mean the markup stopped somewhere other than its end. */
const CUT_OFF = new Set(['length', 'blocked', 'interrupted']);

/** Whether this call still asks for a thinking level; turned off once per process if the model rejects it. */
let thinking = true;

export const geminiAppletModel: AppletModel = async ({ system, prompt, signal }) => {
  for (;;) {
    const useThinking = thinking;
    try {
      const res = await ai.generate({
        model: resolveModelRef(),
        system,
        prompt,
        config: {
          temperature: 0.4,
          maxOutputTokens: APPLET_MAX_OUTPUT_TOKENS,
          ...(useThinking ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
        },
        abortSignal: signal,
      });
      return { text: res.text, finishReason: res.finishReason };
    } catch (err) {
      if (useThinking && isBadRequest(err) && /thinking/i.test(err.message)) {
        thinking = false;
        console.warn(`[cortex] applet rejected thinkingLevel=LOW (${firstLine(err)}); retrying with the model default`);
        continue;
      }
      throw err;
    }
  }
};

/**
 * The markup inside the first Markdown fence when the reply is wrapped in one
 * or surrounded by prose (the model adds them despite being told not to),
 * otherwise the whole reply, trimmed. A reply that already starts with a tag is
 * markup, and any fence inside it is the tool's own content (a Markdown editor's
 * sample text), so it is left whole.
 */
export function extractAppletHtml(text: string): string {
  const reply = text.replace(/\r\n?/g, '\n').trim();
  if (reply.startsWith('<')) return reply;
  const fenced = /```[\w-]*[ \t]*\n([\s\S]*?)\n?```/.exec(reply);
  return (fenced ? fenced[1] : reply).trim();
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

/**
 * A reply cut short can still be under the size cap. An unclosed <script> or
 * <style> is the one truncation that would swallow the rest of the frame, so it
 * is rejected on top of the finish reason.
 */
function balanced(html: string): boolean {
  return count(html, /<script\b/gi) === count(html, /<\/script\s*>/gi)
    && count(html, /<style\b/gi) === count(html, /<\/style\s*>/gi);
}

/**
 * Generates the interactive tool for one question. Runs beside the scene and
 * never throws: any failure, timeout or abort resolves to null, and the stream
 * reports the applet as failed without touching the answer.
 */
export async function generateApplet(input: AppletInput, model: AppletModel = geminiAppletModel): Promise<string | null> {
  const started = Date.now();
  const linked = linkedSignal(input.signal, APPLET_TIMEOUT_MS);
  try {
    const reply = await model({
      system: buildAppletPrompt(input.lang),
      prompt: buildAppletRequest(input.query, input.applet),
      signal: linked.signal,
    });
    const extracted = extractAppletHtml(reply.text);
    const cutOff = reply.finishReason !== undefined && CUT_OFF.has(reply.finishReason);
    const html = !cutOff && balanced(extracted) ? sanitizeAppletHtml(extracted) : null;
    if (html === null) {
      console.warn(
        `[cortex] applet rejected ms=${Date.now() - started} finish=${reply.finishReason ?? '-'} `
        + `chars=${extracted.length} balanced=${balanced(extracted)}`,
      );
      return null;
    }
    console.log(`[cortex] applet model=${resolveModelName()} ms=${Date.now() - started} chars=${html.length}`);
    return html;
  } catch (err) {
    if (!input.signal?.aborted) {
      const reason = linked.timedOut() ? `timeout after ${APPLET_TIMEOUT_MS} ms` : firstLine(err);
      console.warn(`[cortex] applet failed ms=${Date.now() - started} (${reason})`);
    }
    return null;
  }
}
