import { CortexError, type ErrorCode } from '../domain/errors.js';
import {
  LIMITS,
  sanitizeAppletHtml,
  sanitizeText,
  validatePreface,
  validateScene,
  type AppletBrief,
  type Scene,
  type ScenePreface,
} from '../domain/Scene.js';
import { captureDir, fixturesEnabled, pickFixture, writeFixture, type FixtureFile } from '../infrastructure/fixtures.js';
import { generateApplet } from './applet.js';
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
 * The interactive tool of a turn. `pending` is sent once, as soon as the
 * preface asks for a tool; exactly one of `ready` or `failed` follows it.
 * The html only ever reaches a sandboxed iframe on the client.
 */
export type AppletEvent =
  | { status: 'pending'; title: string }
  | { status: 'ready'; title: string; html: string }
  | { status: 'failed'; title: string };

/**
 * Server-sent events, in order: `preface` (optional, at most once), `research`
 * (optional, once the grounded stage returns), any number of `partial` scenes,
 * then either `scene` or `error`, then always `done`. Nothing is emitted after
 * the client disconnects. Every partial is a scene payload with only the
 * finished fields; the final `scene` is the authoritative one.
 *
 * When the preface asks for a tool, `applet` {status: 'pending'} follows it
 * directly, and `applet` {status: 'ready' | 'failed'} arrives whenever the
 * generation settles: before, between or after the partials and the scene,
 * but always before `done`, which waits for it. A failed applet never turns
 * into an `error` event. A stream with no applet is unchanged, event for event.
 */
export type StreamEvent =
  | { event: 'preface'; data: ScenePreface }
  | { event: 'applet'; data: AppletEvent }
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

interface FinishedApplet {
  title: string;
  html: string;
}

async function runLive({ query, lang }: StreamInput, { emit, signal }: StreamContext): Promise<void> {
  const started = Date.now();
  const timing = newTiming();
  let preface: ScenePreface | null = null;
  let scene: Scene | null = null;
  /** Null until the preface asks for a tool; then settles once the tool is ready or failed, never rejecting. */
  let appletTask = null as Promise<FinishedApplet | null> | null;
  /** Set just before `done`: a preface that lands later starts no tool. */
  let closing = false;

  // Runs beside research and the scene from the moment the preface asks for it,
  // so a slow tool never holds the answer back; only `done` waits for it.
  const startApplet = (brief: AppletBrief) => {
    if (closing || signal.aborted) return;
    const { title } = brief;
    emit({ event: 'applet', data: { status: 'pending', title } });
    appletTask = generateApplet({ query, lang, applet: brief, signal })
      .then((html): FinishedApplet | null => {
        if (signal.aborted) return null;
        emit(html === null
          ? { event: 'applet', data: { status: 'failed', title } }
          : { event: 'applet', data: { status: 'ready', title, html } });
        return html === null ? null : { title, html };
      })
      .catch((err: unknown) => {
        console.warn(`[cortex] applet event failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
  };

  // Preface (fast router) and research (grounded search) run together from t=0.
  const prefaceTask = generatePreface({ query, lang, signal })
    .then(result => {
      preface = result;
      if (result) {
        timing.prefaceMs = Date.now() - started;
        if (!signal.aborted) emit({ event: 'preface', data: result });
        if (result.applet) startApplet(result.applet);
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

    const result = await generateScene({
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
    timing.sources = result.sources?.length ?? timing.sources;
    if (signal.aborted) return;
    scene = result;
    emit({ event: 'scene', data: result });
  } catch (err) {
    if (signal.aborted) return;
    const code = errorCode(err);
    const message = err instanceof Error ? err.message : String(err);
    if (code === 'GEMINI_ERROR' || code === 'INTERNAL_ERROR') console.error(`[cortex] stream ${code}: ${message}`);
    else console.warn(`[cortex] stream ${code}: ${message}`);
    emit({ event: 'error', data: { code } });
  }

  closing = true;
  const applet = appletTask ? await appletTask : null;
  if (signal.aborted) return;

  // After the applet settles, so a captured fixture carries its markup too.
  const dir = scene ? captureDir() : null;
  if (scene && dir) {
    const fixture: FixtureFile = { query, lang, preface: await prefaceTask, scene, timing };
    if (applet) fixture.applet = applet;
    const file = await writeFixture(dir, fixture).catch((err: unknown) => {
      console.warn(`[cortex] capture failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    });
    if (file) console.log(`[cortex] captured ${file}`);
    if (signal.aborted) return;
  }
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
    // Carried from the very first partial, the way the live path does it.
    // Filling it in only at the `framed` step flipped the hero on mid-stream
    // and re-templated the desktop grid around it. Fixture replay is offline by
    // design, so nothing is verified here — the URL is replayed as captured.
    image_url: scene.image_url,
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

/**
 * The applet a fixture carries, read as untrusted as live output is. `html` is
 * null when the markup fails validation, which replays as a failed applet.
 */
function fixtureApplet(raw: unknown): { title: string; html: string | null } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { title, html } = raw as { title?: unknown; html?: unknown };
  const name = typeof title === 'string' ? sanitizeText(title, LIMITS.appletTitle) : '';
  return name === '' ? null : { title: name, html: sanitizeAppletHtml(html) };
}

/** When a replayed applet turns ready, measured from the start of the stream: mid-answer, like a live one. */
const FIXTURE_APPLET_MS = 4200;

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

  // Pending right after the preface and settled mid-answer, the way the live
  // path does it, so fixture mode exercises the frame's waiting state too.
  const applet = fixture ? fixtureApplet(fixture.applet) : null;
  let appletTask: Promise<void> | null = null;
  if (applet) {
    emit({ event: 'applet', data: { status: 'pending', title: applet.title } });
    appletTask = wait(FIXTURE_APPLET_MS + Math.random() * 800 - (Date.now() - started), signal).then(() => {
      if (signal.aborted) return;
      emit(applet.html === null
        ? { event: 'applet', data: { status: 'failed', title: applet.title } }
        : { event: 'applet', data: { status: 'ready', title: applet.title, html: applet.html } });
    });
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
  if (appletTask) await appletTask;
  if (signal.aborted) return;
  emit({ event: 'done', data: timing });
}

export function runCortexStream(input: StreamInput, context: StreamContext): Promise<void> {
  return fixturesEnabled() ? runFixture(input, context) : runLive(input, context);
}
