import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeAppletHtml, validatePreface, validateScene, type ScenePreface } from '../domain/Scene.js';
import { pickFixture, type FixtureFile } from '../infrastructure/fixtures.js';
import type { StreamEvent } from './cortexStream.js';

vi.mock('./preface.js', () => ({ generatePreface: vi.fn() }));
vi.mock('./research.js', () => ({ runResearch: vi.fn() }));
vi.mock('./cortexFlow.js', () => ({ generateScene: vi.fn() }));
vi.mock('./applet.js', () => ({ generateApplet: vi.fn() }));

const { generatePreface } = await import('./preface.js');
const { runResearch } = await import('./research.js');
const { generateScene } = await import('./cortexFlow.js');
const { generateApplet } = await import('./applet.js');
const { runCortexStream } = await import('./cortexStream.js');

const BRIEF = { title: 'CSS colour picker', brief: 'HSL sliders and copyable output' };
const HTML = '<div id="tool"></div><script>document.getElementById("tool").textContent = "ok";</script>';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

const PREFACE: ScenePreface = {
  intent: 'explanation',
  title: 'Why is the sky blue?',
  layout: 'focus',
  mood: 'calm',
  palette: { primary: '#7FD8FF', secondary: '#8C9EFF', accent: '#5EF2C2' },
  plan: ['a', 'b', 'c'],
};

const SCENE = validateScene({ title: 'Sky', modules: [], answer: { headline: 'Rayleigh scattering', body: ['p'] } });

function collect() {
  const events: StreamEvent[] = [];
  return { events, emit: (e: StreamEvent) => { events.push(e); } };
}

beforeEach(() => {
  vi.mocked(generatePreface).mockResolvedValue(PREFACE);
  vi.mocked(runResearch).mockResolvedValue({ brief: 'notes', sources: [], imageUrl: '', searches: 1 });
  vi.mocked(generateScene).mockImplementation(async input => {
    input.onPartial?.({ title: 'Sky' });
    return SCENE;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('runCortexStream: live path without an applet', () => {
  it('emits preface, research, partial, scene, done in that order', async () => {
    const { events, emit } = collect();
    await runCortexStream({ query: 'Why is the sky blue?', lang: 'en' }, { emit, signal: new AbortController().signal });

    expect(events.map(e => e.event)).toEqual(['preface', 'research', 'partial', 'scene', 'done']);
    expect(events[0].data).toEqual(PREFACE);
    expect(events[1].data).toEqual({ sources: 0, searches: 1 });
    expect(events[3].data).toEqual(SCENE);
    expect(generateApplet).not.toHaveBeenCalled();
  });

  it('emits error then done when the scene fails', async () => {
    vi.mocked(generateScene).mockRejectedValue(new Error('boom'));
    const { events, emit } = collect();
    await runCortexStream({ query: 'q', lang: 'en' }, { emit, signal: new AbortController().signal });

    expect(events.map(e => e.event)).toEqual(['preface', 'research', 'error', 'done']);
    expect(events[2].data).toEqual({ code: 'INTERNAL_ERROR' });
  });
});

describe('runCortexStream: live path with an applet', () => {
  beforeEach(() => {
    vi.mocked(generatePreface).mockResolvedValue({ ...PREFACE, applet: BRIEF });
  });

  it('starts the applet with the preface, does not hold the scene back, and emits done only once it settles', async () => {
    const applet = deferred<string | null>();
    vi.mocked(generateApplet).mockReturnValue(applet.promise);
    const { events, emit } = collect();
    const run = runCortexStream({ query: 'css color picker', lang: 'en' }, { emit, signal: new AbortController().signal });

    await vi.waitFor(() => expect(events.map(e => e.event)).toContain('scene'));
    expect(events.map(e => e.event)).toEqual(['preface', 'applet', 'research', 'partial', 'scene']);
    expect(events[1].data).toEqual({ status: 'pending', title: BRIEF.title });

    applet.resolve(HTML);
    await run;
    expect(events.map(e => e.event)).toEqual(['preface', 'applet', 'research', 'partial', 'scene', 'applet', 'done']);
    expect(events[5].data).toEqual({ status: 'ready', title: BRIEF.title, html: HTML });
    expect(vi.mocked(generateApplet).mock.calls[0][0]).toMatchObject({ query: 'css color picker', lang: 'en', applet: BRIEF });
  });

  it('hands the scene a preface that carries the applet, so its prompt knows a tool is shown', async () => {
    vi.mocked(generateApplet).mockResolvedValue(HTML);
    const { emit } = collect();
    await runCortexStream({ query: 'css color picker', lang: 'en' }, { emit, signal: new AbortController().signal });
    expect(vi.mocked(generateScene).mock.calls[0][0].preface).toEqual({ ...PREFACE, applet: BRIEF });
  });

  it('reports a failed applet on its own event and never as an error', async () => {
    vi.mocked(generateApplet).mockResolvedValue(null);
    const { events, emit } = collect();
    await runCortexStream({ query: 'css color picker', lang: 'en' }, { emit, signal: new AbortController().signal });

    const names = events.map(e => e.event);
    expect(names).not.toContain('error');
    expect(names.filter(n => n !== 'applet')).toEqual(['preface', 'research', 'partial', 'scene', 'done']);
    expect(events.filter(e => e.event === 'applet').map(e => e.data)).toEqual([
      { status: 'pending', title: BRIEF.title },
      { status: 'failed', title: BRIEF.title },
    ]);
  });

  it('still settles the applet before done when the scene fails', async () => {
    const applet = deferred<string | null>();
    vi.mocked(generateApplet).mockReturnValue(applet.promise);
    vi.mocked(generateScene).mockRejectedValue(new Error('boom'));
    const { events, emit } = collect();
    const run = runCortexStream({ query: 'css color picker', lang: 'en' }, { emit, signal: new AbortController().signal });

    await vi.waitFor(() => expect(events.map(e => e.event)).toContain('error'));
    expect(events.map(e => e.event)).not.toContain('done');
    applet.resolve(HTML);
    await run;
    expect(events.map(e => e.event).slice(-3)).toEqual(['error', 'applet', 'done']);
    expect(events.at(-2)!.data).toEqual({ status: 'ready', title: BRIEF.title, html: HTML });
  });

  it('emits nothing more once the client disconnects while the applet is pending', async () => {
    const applet = deferred<string | null>();
    vi.mocked(generateApplet).mockReturnValue(applet.promise);
    const controller = new AbortController();
    const { events, emit } = collect();
    const run = runCortexStream({ query: 'css color picker', lang: 'en' }, { emit, signal: controller.signal });

    await vi.waitFor(() => expect(events.map(e => e.event)).toContain('scene'));
    const before = events.length;
    controller.abort();
    applet.resolve(HTML);
    await run;
    expect(events).toHaveLength(before);
    expect(vi.mocked(generateApplet).mock.calls[0][0].signal).toBe(controller.signal);
  });
});

const FIXTURE_DIR = path.resolve(process.cwd(), 'server/fixtures');
const FIXTURES = readdirSync(FIXTURE_DIR).filter(n => n.endsWith('.json')).sort();
const readFixture = (name: string) => JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf8')) as FixtureFile;

describe('fixtures', () => {
  it.each(FIXTURES)('%s validates, applet included', name => {
    const fixture = readFixture(name);
    expect(() => validateScene(fixture.scene)).not.toThrow();
    const preface = validatePreface(fixture.preface);
    expect(preface).not.toBeNull();
    if (fixture.applet) {
      expect(preface!.applet).toBeDefined();
      expect(sanitizeAppletHtml(fixture.applet.html)).toBe(fixture.applet.html);
    } else {
      expect(preface!.applet).toBeUndefined();
    }
  });

  it.each(FIXTURES)('%s is the fixture its own query picks', async name => {
    const fixture = readFixture(name);
    expect((await pickFixture(fixture.query, fixture.lang))?.query).toBe(fixture.query);
  });

  it('routes the colour picker and stock examples to the new fixtures', async () => {
    expect((await pickFixture('selector de colores css', 'es'))?.query).toBe('CSS color picker: hex, rgb, hsl');
    expect((await pickFixture('evolución de una stock en el tiempo', 'es'))?.query).toBe('Norvane Robotics stock price since 2023');
  });

  it('gives the stock fixture a dated series of 30 or more points and an illustrative-data caveat', () => {
    const scene = validateScene(readFixture('norvane-robotics-stock-price-since-2023.json').scene);
    const chart = scene.modules[0];
    expect(chart.kind).toBe('chart');
    expect(chart.items!.length).toBeGreaterThanOrEqual(30);
    expect(scene.answer.caveats!.join(' ')).toMatch(/fictional company.*illustrative/);
  });
});

describe('runCortexStream: fixture replay with an applet', () => {
  beforeEach(() => {
    vi.stubEnv('CORTEX_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'development');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('replays pending right after the preface, then ready, all before done', async () => {
    const { events, emit } = collect();
    let finished = false;
    const run = runCortexStream({ query: 'CSS color picker: hex, rgb, hsl', lang: 'en' }, { emit, signal: new AbortController().signal })
      .then(() => { finished = true; });
    for (let i = 0; i < 400 && !finished; i += 1) {
      await new Promise(resolve => setImmediate(resolve));
      await vi.advanceTimersByTimeAsync(250);
    }
    await run;

    const names = events.map(e => e.event);
    expect(names.slice(0, 2)).toEqual(['preface', 'applet']);
    expect(names.at(-1)).toBe('done');
    expect(names).not.toContain('error');
    const applets = events.filter(e => e.event === 'applet').map(e => e.data);
    const html = readFixture('css-color-picker-hex-rgb-hsl.json').applet!.html;
    expect(applets).toEqual([
      { status: 'pending', title: 'CSS colour picker' },
      { status: 'ready', title: 'CSS colour picker', html },
    ]);
    expect(names.indexOf('scene')).toBeGreaterThan(0);
  });

  it('replays a fixture without an applet exactly as before: no applet event', async () => {
    const { events, emit } = collect();
    let finished = false;
    const run = runCortexStream({ query: 'Why is the sky blue?', lang: 'en' }, { emit, signal: new AbortController().signal })
      .then(() => { finished = true; });
    for (let i = 0; i < 400 && !finished; i += 1) {
      await new Promise(resolve => setImmediate(resolve));
      await vi.advanceTimersByTimeAsync(250);
    }
    await run;

    const names = events.map(e => e.event);
    expect(names).not.toContain('applet');
    expect(names[0]).toBe('preface');
    expect(names[1]).toBe('research');
    expect(names.slice(-2)).toEqual(['scene', 'done']);
    expect(names.slice(2, -2).every(n => n === 'partial')).toBe(true);
  });
});
