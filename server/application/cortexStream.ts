import { CortexError, type ErrorCode } from '../domain/errors.js';
import { validatePreface, validateScene, type Scene, type ScenePreface } from '../domain/Scene.js';
import { captureDir, fixturesEnabled, pickFixture, writeFixture } from '../infrastructure/fixtures.js';
import { generateScene } from './cortexFlow.js';
import { generatePreface } from './preface.js';
import { runResearch } from './research.js';
import type { ResponseLang } from './prompt.js';

export interface StreamTiming {
  prefaceMs: number | null;
  researchMs: number | null;
  firstPartialMs: number | null;
  sceneMs: number | null;
  sources: number;
}

/**
 * Server-sent events, in order: `preface` (optional, at most once), `research`
 * (optional, once the grounded stage returns), any number of `partial` scenes,
 * then either `scene` or `error`, then always `done`. Nothing is emitted after
 * the client disconnects. Every partial is a scene payload with only the
 * finished fields; the final `scene` is the authoritative one.
 */
export type StreamEvent =
  | { event: 'preface'; data: ScenePreface }
  | { event: 'research'; data: { sources: number; searches: number } }
  | { event: 'partial'; data: Record<string, unknown> }
  | { event: 'scene'; data: Scene }
  | { event: 'error'; data: { code: ErrorCode | 'INTERNAL_ERROR' } }
  | { event: 'done'; data: StreamTiming };

export interface StreamInput {
  query: string;
  lang: ResponseLang;
}

export interface StreamContext {
  emit: (event: StreamEvent) => void;
  signal: AbortSignal;
}

function errorCode(err: unknown): ErrorCode | 'INTERNAL_ERROR' {
  return err instanceof CortexError ? err.code : 'INTERNAL_ERROR';
}

function newTiming(): StreamTiming {
  return { prefaceMs: null, researchMs: null, firstPartialMs: null, sceneMs: null, sources: 0 };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, Math.max(0, ms));
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

/** Grace period for the preface once research is back: its intent picks the thinking level. */
const PREFACE_GRACE_MS = 700;

async function runLive({ query, lang }: StreamInput, { emit, signal }: StreamContext): Promise<void> {
  const started = Date.now();
  const timing = newTiming();
  let preface: ScenePreface | null = null;

  // Preface (fast router) and research (grounded search) run together from t=0.
  const prefaceTask = generatePreface({ query, lang, signal })
    .then(result => {
      preface = result;
      if (result) {
        timing.prefaceMs = Date.now() - started;
        if (!signal.aborted) emit({ event: 'preface', data: result });
      }
      return result;
    });

  try {
    const research = await runResearch({ query, lang, signal });
    if (signal.aborted) return;
    if (research) {
      timing.researchMs = Date.now() - started;
      timing.sources = research.sources.length;
      emit({ event: 'research', data: { sources: research.sources.length, searches: research.searches } });
    }
    if (!preface) await Promise.race([prefaceTask, wait(PREFACE_GRACE_MS, signal)]);
    if (signal.aborted) return;

    const scene = await generateScene({
      query,
      lang,
      signal,
      preface,
      research,
      onPartial: partial => {
        if (signal.aborted) return;
        if (timing.firstPartialMs === null) timing.firstPartialMs = Date.now() - started;
        emit({ event: 'partial', data: partial });
      },
    });
    timing.sceneMs = Date.now() - started;
    timing.sources = scene.sources?.length ?? timing.sources;
    if (signal.aborted) return;
    emit({ event: 'scene', data: scene });

    const dir = captureDir();
    if (dir) {
      const file = await writeFixture(dir, { query, lang, preface: await prefaceTask, scene, timing }).catch((err: unknown) => {
        console.warn(`[cortex] capture failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      if (file) console.log(`[cortex] captured ${file}`);
    }
  } catch (err) {
    if (signal.aborted) return;
    const code = errorCode(err);
    const message = err instanceof Error ? err.message : String(err);
    if (code === 'GEMINI_ERROR' || code === 'INTERNAL_ERROR') console.error(`[cortex] stream ${code}: ${message}`);
    else console.warn(`[cortex] stream ${code}: ${message}`);
    emit({ event: 'error', data: { code } });
  }

  if (signal.aborted) return;
  console.log(
    `[cortex] stream done preface_ms=${timing.prefaceMs ?? '-'} research_ms=${timing.researchMs ?? '-'} `
    + `first_partial_ms=${timing.firstPartialMs ?? '-'} scene_ms=${timing.sceneMs ?? '-'} sources=${timing.sources}`,
  );
  emit({ event: 'done', data: timing });
}

/**
 * Progressive reveal of a captured scene: headline, then the answer paragraph
 * by paragraph, then the framing (spotlight, attributes), then one module at a
 * time — the same shape the live stream produces, so the fixture path exercises
 * the streaming UI.
 */
export function fixturePartials(scene: Scene): Array<Record<string, unknown>> {
  const shell: Record<string, unknown> = {
    version: scene.version,
    intent: scene.intent,
    type: scene.type,
    title: scene.title,
    subtitle: scene.subtitle,
    presentation: scene.presentation,
    image_url: '',
    meta: {},
    modules: [],
  };
  if (scene.sources) shell.sources = scene.sources;

  const steps: Array<Record<string, unknown>> = [];
  const push = (patch: Record<string, unknown>) => steps.push({ ...shell, ...patch });

  const headline = scene.answer.headline;
  const half = headline.slice(0, Math.max(0, headline.lastIndexOf(' ', Math.floor(headline.length * 0.6))));
  if (half.length > 24) push({ answer: { headline: `${half}…`, body: [] } });
  push({ answer: { headline, body: [] } });

  for (let i = 1; i <= scene.answer.body.length; i += 1) {
    push({ answer: { headline, body: scene.answer.body.slice(0, i) } });
  }

  const answer = { headline, body: scene.answer.body, ...(scene.answer.caveats ? { caveats: scene.answer.caveats } : {}) };
  const framed: Record<string, unknown> = { answer, meta: scene.meta, image_url: scene.image_url };
  if (scene.spotlight) framed.spotlight = scene.spotlight;
  push(framed);

  for (let i = 1; i <= scene.modules.length; i += 1) {
    push({ ...framed, modules: scene.modules.slice(0, i) });
  }
  return steps;
}

/** Replays a captured fixture with realistic timing (preface ~0.7 s, research ~3 s, partials, scene). */
async function runFixture({ query, lang }: StreamInput, { emit, signal }: StreamContext): Promise<void> {
  const started = Date.now();
  const timing = newTiming();
  const fixture = await pickFixture(query, lang);

  await wait(600 + Math.random() * 200, signal);
  if (signal.aborted) return;
  const preface = fixture ? validatePreface(fixture.preface) : null;
  if (preface) {
    timing.prefaceMs = Date.now() - started;
    emit({ event: 'preface', data: preface });
  }

  try {
    if (!fixture) throw new CortexError('No fixtures available', 'GEMINI_ERROR');
    const scene = validateScene(fixture.scene);

    await wait(2400 - (Date.now() - started), signal);
    if (signal.aborted) return;
    timing.researchMs = Date.now() - started;
    timing.sources = scene.sources?.length ?? 0;
    emit({ event: 'research', data: { sources: timing.sources, searches: timing.sources > 0 ? 2 : 0 } });

    const partials = fixturePartials(scene);
    for (const partial of partials) {
      await wait(220 + Math.random() * 120, signal);
      if (signal.aborted) return;
      if (timing.firstPartialMs === null) timing.firstPartialMs = Date.now() - started;
      emit({ event: 'partial', data: partial });
    }

    await wait(420, signal);
    if (signal.aborted) return;
    timing.sceneMs = Date.now() - started;
    emit({ event: 'scene', data: scene });
  } catch (err) {
    if (signal.aborted) return;
    console.warn(`[cortex] fixture stream failed: ${err instanceof Error ? err.message : String(err)}`);
    emit({ event: 'error', data: { code: errorCode(err) } });
  }
  if (signal.aborted) return;
  emit({ event: 'done', data: timing });
}

export function runCortexStream(input: StreamInput, context: StreamContext): Promise<void> {
  return fixturesEnabled() ? runFixture(input, context) : runLive(input, context);
}
