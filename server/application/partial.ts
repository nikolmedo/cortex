/**
 * Partial scene extraction for streaming.
 *
 * `generateStream` exposes the half-parsed JSON object built from the text so
 * far, which means the last key of every object and the last element of every
 * array can be cut mid-value. Anything that could still change is dropped, so a
 * partial only ever carries values the model has finished writing:
 *
 * - object: every key except the last one is settled; the last key is recursed
 *   into (its own finished children survive).
 * - array: every element except the last one is settled; the last element is
 *   recursed into for objects, dropped for scalars.
 * - string: dropped, except for prose paragraphs, which are cut back to their
 *   last completed phrase so the answer can grow phrase by phrase.
 *
 * Modules are the exception to "recurse into the last element": a half-written
 * module renders as a broken card, so the last one waits until it is settled.
 */

import { LIMITS, sanitizeCode, sanitizeText } from '../domain/Scene.js';

const PHRASE_END = /[.!?;:,](?=\s)|[.!?](?=$)/g;

/**
 * Keys whose text is code-like (code module bodies, formula labels): newlines,
 * indentation and angle brackets have to survive, so they take sanitizeCode.
 * The client applies the kind-specific rule to the same field afterwards.
 */
const CODE_KEYS = new Set(['body', 'label']);

/** Validated downstream by safeHttpsUrl; text sanitising would corrupt them. */
const URL_KEYS = new Set(['image_url', 'url']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The part of a streamed paragraph that will not change any more. */
function settledProse(text: string): string | undefined {
  PHRASE_END.lastIndex = 0;
  let end = -1;
  for (let m = PHRASE_END.exec(text); m !== null; m = PHRASE_END.exec(text)) end = m.index + 1;
  const head = end > 0 ? text.slice(0, end).trim() : '';
  return head.length >= 24 ? head : undefined;
}

type Mode = 'drop' | 'prose';

function settle(value: unknown, done: boolean, mode: Mode): unknown {
  if (done || typeof value === 'boolean') return value;
  if (typeof value === 'string') return mode === 'prose' ? settledProse(value) : undefined;
  if (typeof value === 'number') return undefined;
  if (Array.isArray(value)) {
    const out = value.slice(0, -1);
    const last = value[value.length - 1];
    if (isObject(last)) {
      const tail = settle(last, false, mode);
      if (tail !== undefined) out.push(tail);
    } else if (typeof last === 'string' && mode === 'prose') {
      const tail = settledProse(last);
      if (tail !== undefined) out.push(tail);
    }
    return out;
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    const out: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      const settledKey = i < keys.length - 1;
      const childMode: Mode = key === 'body' || key === 'summary' ? 'prose' : mode;
      const child = settle(value[key], settledKey, childMode);
      if (child !== undefined) out[key] = child;
    });
    return out;
  }
  return undefined;
}

/**
 * Lenient sanitising pass over a partial payload. The strict per-field caps are
 * the final scene's job; this only guarantees that no partial reaches the client
 * carrying control characters or unescaped markup, using the same domain
 * sanitizers the strict schema uses.
 */
function clean(value: unknown, key: string): unknown {
  if (typeof value === 'string') {
    if (URL_KEYS.has(key)) return value;
    return CODE_KEYS.has(key) ? sanitizeCode(value, LIMITS.code) : sanitizeText(value, LIMITS.code);
  }
  if (Array.isArray(value)) return value.map(v => clean(v, key));
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = clean(v, k);
    return out;
  }
  return value;
}

/**
 * Turns the half-parsed output of a stream chunk into a scene payload safe to
 * render, or null while there is not enough to show. `modules` is always an
 * array and `title` is always present, so the client sanitizer accepts it.
 */
export function partialScene(raw: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> | null {
  if (!isObject(raw)) return null;
  const settled = settle(raw, false, 'drop');
  if (!isObject(settled)) return null;

  const title = typeof settled.title === 'string' ? settled.title.trim() : '';
  if (title === '') return null;

  const rawModules = Array.isArray(settled.modules) ? settled.modules : [];
  // A module is only shown once the next module (or the key after modules) started.
  const modules = Object.keys(settled).indexOf('modules') < Object.keys(settled).length - 1
    ? rawModules
    : rawModules.slice(0, -1);

  const answer = isObject(settled.answer) ? settled.answer : {};
  const headline = typeof answer.headline === 'string' ? answer.headline : '';
  const body = Array.isArray(answer.body) ? answer.body : [];
  if (headline === '' && body.length === 0 && modules.length === 0) return null;

  return clean({ ...settled, ...extra, modules }, '') as Record<string, unknown>;
}
