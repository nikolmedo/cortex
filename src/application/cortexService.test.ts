import { afterEach, describe, expect, it, vi } from 'vitest';
import { CortexApiError, streamCortex } from './cortexService';

/**
 * Drives `streamCortex` against a stubbed fetch returning a ReadableStream of
 * SSE bytes. Node supplies fetch, ReadableStream, TextDecoder and DOMException,
 * so nothing here touches the network.
 */

const encoder = new TextEncoder();

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function stubFetch(chunks: string[], init: ResponseInit = { status: 200 }): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(streamOf(chunks), init)));
}

function frame(event: string, data: unknown, eol = '\n'): string {
  return `event: ${event}${eol}data: ${JSON.stringify(data)}${eol}${eol}`;
}

const PREFACE = { intent: 'howto', title: 'How to sail', mood: 'kinetic', plan: ['a', 'b', 'c'] };
const PARTIAL = { title: 'How to sail', modules: [], answer: { headline: 'Partial' } };
const SCENE = { title: 'How to sail', modules: [], answer: { headline: 'Final', body: ['p1'] } };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamCortex', () => {
  it('reports preface, research and partial, then resolves with the final scene', async () => {
    stubFetch([
      frame('preface', PREFACE),
      frame('research', { sources: 4, searches: 2 }),
      frame('partial', PARTIAL),
      frame('scene', SCENE),
      frame('done', {}),
    ]);

    const onPreface = vi.fn();
    const onResearch = vi.fn();
    const onPartial = vi.fn();
    const scene = await streamCortex('q', 'en', { onPreface, onResearch, onPartial });

    expect(onPreface).toHaveBeenCalledTimes(1);
    expect(onPreface.mock.calls[0][0]).toMatchObject({ intent: 'howto', title: 'How to sail', layout: 'sequence', mood: 'kinetic' });
    expect(onResearch).toHaveBeenCalledWith({ sources: 4, searches: 2 });
    expect(onPartial).toHaveBeenCalledTimes(1);
    expect(onPartial.mock.calls[0][0]).toMatchObject({ answer: { headline: 'Partial' } });
    expect(scene).toMatchObject({ title: 'How to sail', answer: { headline: 'Final', body: ['p1'] } });
  });

  it('accepts CRLF-delimited frames and frames split across chunks', async () => {
    const sceneFrame = frame('scene', SCENE);
    const split = Math.floor(sceneFrame.length / 2);
    stubFetch([
      frame('preface', PREFACE, '\r\n'),
      sceneFrame.slice(0, split),
      sceneFrame.slice(split),
      frame('done', {}),
    ]);

    const onPreface = vi.fn();
    const scene = await streamCortex('q', 'en', { onPreface });
    expect(onPreface).toHaveBeenCalledTimes(1);
    expect(scene).toMatchObject({ answer: { headline: 'Final' } });
  });

  it('ignores a preface that arrives twice and unknown events', async () => {
    stubFetch([
      frame('preface', PREFACE),
      frame('preface', { ...PREFACE, title: 'Second' }),
      frame('heartbeat', {}),
      frame('scene', SCENE),
      frame('done', {}),
    ]);

    const onPreface = vi.fn();
    await streamCortex('q', 'en', { onPreface });
    expect(onPreface).toHaveBeenCalledTimes(1);
    expect(onPreface.mock.calls[0][0].title).toBe('How to sail');
  });

  it('skips a partial that fails to sanitize instead of failing the stream', async () => {
    stubFetch([
      frame('partial', { modules: [] }),
      frame('partial', PARTIAL),
      frame('scene', SCENE),
      frame('done', {}),
    ]);

    const onPartial = vi.fn();
    const scene = await streamCortex('q', 'en', { onPartial });
    expect(onPartial).toHaveBeenCalledTimes(1);
    expect(scene).toMatchObject({ answer: { headline: 'Final' } });
  });

  it('maps an error event onto its translation key', async () => {
    stubFetch([frame('error', { code: 'GEMINI_ERROR' })]);
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ name: 'CortexApiError', key: 'error.upstream' });
  });

  it('maps an unknown error code onto error.unknown', async () => {
    stubFetch([frame('error', { code: 'WAT' })]);
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ key: 'error.unknown' });
  });

  it('maps a non-ok response body onto its translation key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'INVALID_INPUT', error: 'query too long' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )));
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ key: 'error.validation' });
  });

  it('rejects when done arrives without a scene', async () => {
    stubFetch([frame('preface', PREFACE), frame('done', {})]);
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ key: 'error.unknown' });
  });

  it('rejects when the stream closes before a scene arrives', async () => {
    stubFetch([frame('preface', PREFACE)]);
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ key: 'error.network' });
  });

  it('rejects with error.parse for malformed frame data', async () => {
    stubFetch(['event: scene\ndata: {not json\n\n']);
    await expect(streamCortex('q', 'en')).rejects.toMatchObject({ key: 'error.parse' });
  });

  it('rejects immediately with an AbortError when the signal is already aborted', async () => {
    stubFetch([frame('scene', SCENE), frame('done', {})]);
    const controller = new AbortController();
    controller.abort();
    await expect(streamCortex('q', 'en', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('posts the query and language to the stream endpoint', async () => {
    stubFetch([frame('scene', SCENE), frame('done', {})]);
    await streamCortex('sailing', 'es');
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('/api/cortex/stream');
    expect(call[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(call[1].body)).toEqual({ query: 'sailing', lang: 'es' });
  });

  it('reports a CortexApiError instance, not a bare Error', async () => {
    stubFetch([frame('error', { code: 'PARSE_FAILURE' })]);
    await expect(streamCortex('q', 'en')).rejects.toBeInstanceOf(CortexApiError);
  });
});
