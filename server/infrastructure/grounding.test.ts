import { describe, expect, it } from 'vitest';
import { LIMITS } from '../domain/Scene.js';
import { sourcesFromGrounding } from './grounding.js';

/** Wraps chunks in the shape `res.custom` actually has. */
function custom(chunks: unknown): unknown {
  return { candidates: [{ groundingMetadata: { groundingChunks: chunks } }] };
}

describe('sourcesFromGrounding', () => {
  it('returns [] when the payload carries no chunk array', () => {
    expect(sourcesFromGrounding(undefined)).toEqual([]);
    expect(sourcesFromGrounding(null)).toEqual([]);
    expect(sourcesFromGrounding({})).toEqual([]);
    expect(sourcesFromGrounding({ candidates: [] })).toEqual([]);
    expect(sourcesFromGrounding(custom('not an array'))).toEqual([]);
    expect(sourcesFromGrounding(custom(undefined))).toEqual([]);
  });

  it('keeps https URLs and drops everything else', () => {
    const out = sourcesFromGrounding(custom([
      { web: { uri: 'https://a.com/1', title: 'A' } },
      { web: { uri: 'http://b.com', title: 'B' } },
      { web: { uri: 'javascript:alert(1)', title: 'C' } },
      { web: { uri: 'data:text/html,x', title: 'D' } },
    ]));
    expect(out).toEqual([{ title: 'A', url: 'https://a.com/1' }]);
  });

  it('skips malformed chunks without failing', () => {
    const out = sourcesFromGrounding(custom([
      null,
      {},
      { web: {} },
      { web: { uri: 42 } },
      { web: { uri: 'https://ok.com', title: 'OK' } },
    ]));
    expect(out).toEqual([{ title: 'OK', url: 'https://ok.com' }]);
  });

  it('dedupes by title, ignoring case', () => {
    const out = sourcesFromGrounding(custom([
      { web: { uri: 'https://a.com/1', title: 'Reuters' } },
      { web: { uri: 'https://a.com/2', title: 'REUTERS' } },
      { web: { uri: 'https://a.com/3', title: 'reuters' } },
      { web: { uri: 'https://a.com/4', title: 'AP' } },
    ]));
    expect(out).toEqual([
      { title: 'Reuters', url: 'https://a.com/1' },
      { title: 'AP', url: 'https://a.com/4' },
    ]);
  });

  it('falls back to the URL host when the title is missing or blank', () => {
    const out = sourcesFromGrounding(custom([
      { web: { uri: 'https://host.example/p' } },
      { web: { uri: 'https://blank.example/p', title: '   ' } },
      { web: { uri: 'https://number.example/p', title: 7 } },
    ]));
    expect(out).toEqual([
      { title: 'host.example', url: 'https://host.example/p' },
      { title: 'blank.example', url: 'https://blank.example/p' },
      { title: 'number.example', url: 'https://number.example/p' },
    ]);
  });

  it('trims the title it keeps', () => {
    const out = sourcesFromGrounding(custom([{ web: { uri: 'https://a.com', title: '  Reuters  ' } }]));
    expect(out).toEqual([{ title: 'Reuters', url: 'https://a.com' }]);
  });

  it('caps the result at LIMITS.maxSources', () => {
    const chunks = Array.from({ length: LIMITS.maxSources + 6 }, (_, i) => ({
      web: { uri: `https://s${i}.example`, title: `T${i}` },
    }));
    const out = sourcesFromGrounding(custom(chunks));
    expect(out).toHaveLength(LIMITS.maxSources);
    expect(out[0]).toEqual({ title: 'T0', url: 'https://s0.example' });
  });
});
