import { describe, expect, it } from 'vitest';
import { partialScene } from './partial.js';

/**
 * `partialScene` reads the half-parsed JSON of a stream chunk, so every case
 * below is built around key insertion order: the last key of an object and the
 * last element of an array are the ones that may still be growing.
 */

const ELLIPSIS = '…';
const LSAQ = '‹';
const RSAQ = '›';

describe('partialScene: nothing renderable yet', () => {
  it('returns null for a non-object payload', () => {
    expect(partialScene('nope')).toBeNull();
    expect(partialScene(null)).toBeNull();
    expect(partialScene([{ title: 'T' }])).toBeNull();
    expect(partialScene(undefined)).toBeNull();
  });

  it('returns null while the title is still the last key', () => {
    // A trailing string is unsettled, so it is dropped and no title survives.
    expect(partialScene({ title: 'Hello' })).toBeNull();
  });

  it('returns null for a blank title', () => {
    expect(partialScene({ title: '   ', subtitle: 'S', answer: { headline: 'H' }, x: 'y' })).toBeNull();
  });

  it('returns null when the title is settled but nothing is renderable', () => {
    expect(partialScene({ title: 'Hello', subtitle: 'x' })).toBeNull();
  });

  it('returns null when the only module is still the last element', () => {
    expect(partialScene({ title: 'T', modules: [{ category: 'A' }], tail: 'z' })).toBeNull();
  });
});

describe('partialScene: objects', () => {
  it('keeps every key except the last verbatim and recurses into the last', () => {
    // `answer` is settled, so it survives whole; `summary` is the growing key.
    const out = partialScene({
      title: 'T',
      answer: { headline: 'H' },
      summary: 'A settled sentence goes here now. tail',
    });
    expect(out).toEqual({
      title: 'T',
      answer: { headline: 'H' },
      summary: 'A settled sentence goes here now.',
      modules: [],
    });
  });

  it('drops the last key of a nested object', () => {
    // Inside `answer`, `headline` is last and therefore unsettled.
    const out = partialScene({ title: 'T', answer: { body: ['A fully settled sentence sits here.'], headline: 'H' } });
    expect(out).toEqual({ title: 'T', answer: { body: ['A fully settled sentence sits here.'] }, modules: [] });
  });

  it('drops a trailing number but keeps a trailing boolean', () => {
    const base = { title: 'T', subtitle: 'S', answer: { headline: 'H', body: [] }, modules: [] };
    expect(partialScene({ ...base, flag: true })).toMatchObject({ flag: true });
    expect(partialScene({ title: 'T', subtitle: 'S', version: 3 })).toBeNull();
  });
});

describe('partialScene: arrays', () => {
  it('drops a trailing scalar element', () => {
    const out = partialScene({ title: 'T', answer: { headline: 'H', body: [] }, modules: [], facts: ['a', 'b'] });
    expect(out).toMatchObject({ facts: ['a'] });
  });

  it('recurses into a trailing object element instead of dropping it', () => {
    const out = partialScene({
      title: 'T',
      answer: { headline: 'H', body: [] },
      modules: [],
      meta: [{ k: 1, v: 2 }, { k: 3, v: 4 }],
    });
    // The settled element survives whole; the growing one loses its last key.
    expect(out).toMatchObject({ meta: [{ k: 1, v: 2 }, { k: 3 }] });
  });
});

describe('partialScene: prose', () => {
  it('cuts a growing paragraph back to its last completed phrase', () => {
    const out = partialScene({ title: 'T', answer: { headline: 'H', body: ['One complete sentence here. And a half'] } });
    expect(out).toMatchObject({ answer: { body: ['One complete sentence here.'] } });
  });

  it('treats a semicolon as a phrase end', () => {
    const out = partialScene({ title: 'T', answer: { headline: 'H', body: ['First clause is long enough; second clause unfinished'] } });
    expect(out).toMatchObject({ answer: { body: ['First clause is long enough;'] } });
  });

  it('drops a settled phrase shorter than the 24-character minimum', () => {
    const short = partialScene({ title: 'T', answer: { headline: 'H', body: ['Hi. x'] } });
    expect(short).toMatchObject({ answer: { body: [] } });
    // 23 characters up to the period: still under the minimum.
    const justUnder = partialScene({ title: 'T', answer: { headline: 'H', body: ['Exactly twenty four ch. rest'] } });
    expect(justUnder).toMatchObject({ answer: { body: [] } });
  });

  it('keeps only the settled paragraphs of a growing body', () => {
    const out = partialScene({
      title: 'T',
      answer: { headline: 'H', body: ['Settled paragraph number one here.', 'Second one is done too, and then some'] },
    });
    expect(out).toMatchObject({ answer: { body: ['Settled paragraph number one here.'] } });
  });

  it('applies prose mode to summary as well as body', () => {
    const out = partialScene({ title: 'T', answer: { headline: 'H' }, summary: 'A settled sentence goes here now. tail' });
    expect(out).toMatchObject({ summary: 'A settled sentence goes here now.' });
  });
});

describe('partialScene: modules', () => {
  it('holds the last module back until the key after modules has started', () => {
    const modules = [{ category: 'A', kind: 'list' }, { category: 'B', kind: 'list' }];
    const held = partialScene({ title: 'T', answer: { headline: 'H', body: [] }, modules });
    expect(held).toMatchObject({ modules: [{ category: 'A', kind: 'list' }] });

    const released = partialScene({ title: 'T', answer: { headline: 'H', body: [] }, modules, followups: [] });
    expect(released).toMatchObject({ modules: [{ category: 'A', kind: 'list' }, { category: 'B', kind: 'list' }] });
  });

  it('counts only the keys that survived settling when deciding to hold', () => {
    // `tail` is an unsettled string, so it is dropped and `modules` becomes last.
    const out = partialScene({
      title: 'T',
      answer: { headline: 'H', body: [] },
      modules: [{ category: 'A' }, { category: 'B' }],
      tail: 'z',
    });
    expect(out).toMatchObject({ modules: [{ category: 'A' }] });
  });

  it('always emits modules as an array, even when the raw value is not one', () => {
    const out = partialScene({ title: 'T', modules: 'nope', answer: { headline: 'H' }, z: 'w' });
    expect(out).toMatchObject({ modules: [] });
  });
});

describe('partialScene: sanitising', () => {
  it('runs plain text through sanitizeText', () => {
    const out = partialScene({
      title: `T${String.fromCharCode(7)}X`,
      subtitle: 'a<b>c',
      answer: { headline: 'H' },
      z: 'w',
    });
    expect(out).toMatchObject({ title: 'TX', subtitle: `a${LSAQ}b${RSAQ}c` });
  });

  it('runs answer body paragraphs through sanitizeCode, so angle brackets survive', () => {
    // `clean` keys on the field name, and `body` is a code key. The client
    // re-sanitises answer paragraphs with sanitizeText before rendering.
    const out = partialScene({
      title: 'T',
      subtitle: 'S',
      answer: { headline: 'H', body: ['A <b> tag lives here okay now.'] },
      modules: [],
      z: 1,
    });
    expect(out).toMatchObject({ answer: { body: ['A <b> tag lives here okay now.'] } });
  });

  it('runs body and label through sanitizeCode so newlines survive', () => {
    const out = partialScene({
      title: 'T',
      subtitle: 'S',
      answer: { headline: 'H', body: [] },
      modules: [{ label: 'a\n  b' }, {}],
      x: 1,
    });
    expect(out).toMatchObject({ modules: [{ label: 'a\n  b' }] });
  });

  it('leaves url and image_url untouched', () => {
    const out = partialScene({
      title: 'T',
      subtitle: 'S',
      answer: { headline: 'H', body: [] },
      image_url: 'https://e.com/a<b>',
      modules: [],
      z: 1,
    });
    // Angle brackets survive: safeHttpsUrl validates these fields downstream.
    expect(out).toMatchObject({ image_url: 'https://e.com/a<b>' });
  });

  it('merges the extra fields over the settled payload', () => {
    const sources = [{ title: 'x', url: 'https://a.com' }];
    const out = partialScene({ title: 'T', subtitle: 'S', answer: { headline: 'H', body: [] }, modules: [], q: 1 }, { sources });
    expect(out).toMatchObject({ sources });
  });

  it('does not truncate below the code limit', () => {
    const long = 'x'.repeat(40);
    const out = partialScene({ title: 'T', subtitle: long, answer: { headline: 'H' }, z: 'w' });
    expect(out?.subtitle).toBe(long);
    expect(String(out?.subtitle)).not.toContain(ELLIPSIS);
  });
});
