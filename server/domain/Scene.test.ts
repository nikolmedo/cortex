import { describe, expect, it } from 'vitest';
import { CortexError } from './errors.js';
import {
  DEFAULT_PALETTE,
  FACT_KINDS,
  LIMITS,
  SCENE_VERSION,
  hexOr,
  isHex,
  itemCap,
  itemShape,
  luminousHex,
  normalizeHex,
  safeHttpsUrl,
  sanitizeCode,
  sanitizeText,
  truncateText,
  validatePreface,
  validateScene,
} from './Scene.js';

const ELLIPSIS = '…';
const LSAQ = '‹';
const RSAQ = '›';
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

describe('truncateText', () => {
  it('returns the input untouched when it fits', () => {
    expect(truncateText('hello', 10)).toBe('hello');
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('cuts at the last word boundary when that keeps 60% of the budget', () => {
    expect(truncateText('the quick brown fox jumps', 12)).toBe(`the quick${ELLIPSIS}`);
  });

  it('cuts mid-word when the last boundary is too early', () => {
    expect(truncateText('abcdefghijklmnop', 6)).toBe(`abcde${ELLIPSIS}`);
  });

  it('hard-slices without an ellipsis when the budget is under 2', () => {
    expect(truncateText('abcdef', 1)).toBe('a');
    expect(truncateText('abcdef', 0)).toBe('');
  });

  it('strips trailing punctuation before the ellipsis', () => {
    expect(truncateText('alpha beta, gamma delta', 14)).toBe(`alpha beta${ELLIPSIS}`);
  });
});

describe('sanitizeText', () => {
  it('strips control characters', () => {
    expect(sanitizeText(`a${NUL}b${BEL}c`, 50)).toBe('abc');
  });

  it('neutralises angle brackets', () => {
    expect(sanitizeText('<script>x</script>', 50)).toBe(`${LSAQ}script${RSAQ}x${LSAQ}/script${RSAQ}`);
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeText('  a   b\n\tc  ', 50)).toBe('a b c');
  });

  it('truncates to the cap', () => {
    expect(sanitizeText('x'.repeat(40), 10)).toBe(`${'x'.repeat(9)}${ELLIPSIS}`);
  });
});

describe('sanitizeCode', () => {
  it('normalises CRLF and CR to LF', () => {
    expect(sanitizeCode('a\r\nb\rc', 100)).toBe('a\nb\nc');
  });

  it('keeps newlines, indentation and angle brackets', () => {
    expect(sanitizeCode('\n\n  const a = 1;\n  <b>\n\n', 100)).toBe('  const a = 1;\n  <b>');
  });

  it('strips control characters other than newline and tab', () => {
    expect(sanitizeCode(`a${NUL}\tb${BEL}`, 100)).toBe('a\tb');
  });

  it('hard-slices at the cap with no ellipsis', () => {
    expect(sanitizeCode('abcdefghij', 4)).toBe('abcd');
  });
});

describe('safeHttpsUrl', () => {
  it('returns a well-formed https URL untouched', () => {
    expect(safeHttpsUrl('https://a.com/x?y=1#z')).toBe('https://a.com/x?y=1#z');
    expect(safeHttpsUrl('  https://a.com  ')).toBe('https://a.com');
  });

  it('rejects every non-https scheme', () => {
    expect(safeHttpsUrl('http://a.com')).toBe('');
    expect(safeHttpsUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpsUrl('data:text/html,<h1>x</h1>')).toBe('');
    expect(safeHttpsUrl('file:///etc/passwd')).toBe('');
  });

  it('rejects blanks, whitespace, over-long values and non-strings', () => {
    expect(safeHttpsUrl('')).toBe('');
    expect(safeHttpsUrl('   ')).toBe('');
    expect(safeHttpsUrl('https://a.com/ x')).toBe('');
    expect(safeHttpsUrl(`https://a.com/${'x'.repeat(LIMITS.url)}`)).toBe('');
    expect(safeHttpsUrl(42)).toBe('');
    expect(safeHttpsUrl(null)).toBe('');
    expect(safeHttpsUrl({})).toBe('');
  });
});

describe('hex helpers', () => {
  it('isHex accepts only a 6-digit hex with a leading hash', () => {
    expect(isHex('#7FD8FF')).toBe(true);
    expect(isHex('#7fd8ff')).toBe(true);
    expect(isHex('7FD8FF')).toBe(false);
    expect(isHex('#7FD8F')).toBe(false);
    expect(isHex('#GGGGGG')).toBe(false);
    expect(isHex(42)).toBe(false);
  });

  it('normalizeHex adds the missing hash and leaves anything else alone', () => {
    expect(normalizeHex('7FD8FF')).toBe('#7FD8FF');
    expect(normalizeHex('#7FD8FF')).toBe('#7FD8FF');
    expect(normalizeHex('zzz')).toBe('zzz');
    expect(normalizeHex(42)).toBe(42);
  });

  it('luminousHex leaves near-greys and already-luminous colors alone', () => {
    expect(luminousHex('#808080')).toBe('#808080');
    expect(luminousHex(DEFAULT_PALETTE.primary)).toBe(DEFAULT_PALETTE.primary);
    expect(luminousHex(DEFAULT_PALETTE.secondary)).toBe(DEFAULT_PALETTE.secondary);
    expect(luminousHex(DEFAULT_PALETTE.accent)).toBe(DEFAULT_PALETTE.accent);
  });

  it('luminousHex lifts a dark saturated color into the readable band', () => {
    const lifted = luminousHex('#001F3F');
    expect(lifted).not.toBe('#001F3F');
    expect(isHex(lifted)).toBe(true);
    // Lifting is idempotent: the result is already inside the band.
    expect(luminousHex(lifted)).toBe(lifted);
  });

  it('hexOr falls back for anything that is not a hex', () => {
    expect(hexOr('nope', DEFAULT_PALETTE.primary)).toBe(DEFAULT_PALETTE.primary);
    expect(hexOr(undefined, DEFAULT_PALETTE.primary)).toBe(DEFAULT_PALETTE.primary);
    expect(hexOr('#GGGGGG', DEFAULT_PALETTE.primary)).toBe(DEFAULT_PALETTE.primary);
  });

  it('hexOr accepts a bare hex and lifts it', () => {
    expect(hexOr('7FD8FF', DEFAULT_PALETTE.primary)).toBe('#7FD8FF');
    expect(hexOr('001F3F', DEFAULT_PALETTE.primary)).toBe(luminousHex('#001F3F'));
  });
});

describe('itemCap and itemShape', () => {
  it('gives each kind its documented cap', () => {
    expect(itemCap('tags')).toBe(LIMITS.maxTags);
    expect(itemCap('steps')).toBe(LIMITS.maxSteps);
    expect(itemCap('chart')).toBe(LIMITS.maxChartPoints);
    expect(itemCap('panel')).toBe(LIMITS.maxPanel);
    for (const kind of FACT_KINDS) {
      if (!['tags', 'steps', 'chart', 'panel'].includes(kind)) expect(itemCap(kind)).toBe(LIMITS.maxItems);
    }
  });

  it('reads a shape only for panel, and only from the allowlist', () => {
    expect(itemShape('panel', 'bar')).toBe('bar');
    expect(itemShape('panel', 'divider')).toBe('divider');
    expect(itemShape('panel', 'nope')).toBeUndefined();
    expect(itemShape('panel', 42)).toBeUndefined();
    expect(itemShape('list', 'bar')).toBeUndefined();
    expect(itemShape('stats', 'bar')).toBeUndefined();
  });
});

describe('validateScene: structural failures', () => {
  it('throws VALIDATION_ERROR when the title is missing or empty', () => {
    for (const raw of [{ modules: [] }, { title: '', modules: [] }, { title: '   ', modules: [] }]) {
      expect(() => validateScene(raw)).toThrow(CortexError);
      try {
        validateScene(raw);
      } catch (err) {
        expect((err as CortexError).code).toBe('VALIDATION_ERROR');
      }
    }
  });

  it('throws when modules is not an array or the payload is not an object', () => {
    expect(() => validateScene({ title: 'T', modules: 'x' })).toThrow(CortexError);
    expect(() => validateScene('x')).toThrow(CortexError);
    expect(() => validateScene(null)).toThrow(CortexError);
  });

  it('accepts the minimal valid payload and fills in every default', () => {
    const scene = validateScene({ title: 'T', modules: [] });
    expect(scene).toMatchObject({
      version: SCENE_VERSION,
      intent: 'explanation',
      type: 'unknown',
      title: 'T',
      subtitle: '',
      summary: '',
      image_url: '',
      meta: {},
      modules: [],
      presentation: { layout: 'focus', mood: 'calm', motif: 'flow', density: 'balanced', palette: DEFAULT_PALETTE },
    });
    expect(scene.spotlight).toBeUndefined();
    expect(scene.followups).toBeUndefined();
    expect(scene.sources).toBeUndefined();
  });
});

describe('validateScene: hostile payload', () => {
  const hostile = {
    title: `Ti${NUL}tle <b>`,
    intent: 'nonsense',
    type: 'wizard',
    subtitle: 42,
    summary: { not: 'a string' },
    image_url: 'javascript:alert(1)',
    image_query: ['x'],
    meta: { a: 'b', '': 'c', d: '', e: 'f', f: 'g', g: 'h', h: 'i', i: 'j', j: 'k', k: 'l' },
    presentation: {
      layout: 'hologram',
      mood: 'angry',
      motif: 999,
      density: null,
      palette: { primary: 'red', secondary: '001F3F', accent: '#GGGGGG' },
    },
    answer: {
      headline: '',
      body: Array.from({ length: 12 }, (_, i) => `para ${i}`),
      caveats: ['a', 'b', 'c', 'd', 'e'],
    },
    spotlight: { kind: 'explosion', label: '   ', value: 'v' },
    modules: [
      { category: 'C', kind: 'tags', color: 'zzz', items: Array.from({ length: 20 }, (_, i) => ({ label: `t${i}` })) },
      { category: 'D', kind: 'code', body: 'line1\r\nline2', value: 'python', facts: ['f'] },
      { category: 'E', kind: 'list', items: [{ label: 'L', weight: 500, side: 'a', shape: 'bar' }] },
      { category: 'F', kind: 'panel', items: [{ label: 'L', weight: 500, shape: 'bar' }, { label: 'M', shape: 'nope' }] },
      'not an object',
      ...Array.from({ length: 10 }, (_, i) => ({ category: `X${i}`, kind: 'list', facts: ['f'] })),
    ],
    followups: ['a', 'b', 'c', 'd', 'e', 'f'],
    sources: [{ title: 'S', url: 'http://insecure.com' }, { title: 'T', url: 'https://ok.com' }],
  };

  const scene = validateScene(hostile);

  it('sanitises the title and coerces out-of-enum values to safe defaults', () => {
    expect(scene.title).toBe(`Title ${LSAQ}b${RSAQ}`);
    expect(scene.intent).toBe('explanation');
    expect(scene.type).toBe('unknown');
    expect(scene.presentation.mood).toBe('calm');
    expect(scene.presentation.motif).toBe('flow');
    expect(scene.presentation.density).toBe('balanced');
    // An unknown layout falls back through the intent table.
    expect(scene.presentation.layout).toBe('focus');
  });

  it('drops a javascript: image URL and an insecure source', () => {
    expect(scene.image_url).toBe('');
    expect(scene.sources).toEqual([{ title: 'T', url: 'https://ok.com' }]);
  });

  it('coerces wrong types', () => {
    expect(scene.subtitle).toBe('42');
    expect(scene.summary).toBe('');
    expect(scene.image_query).toBe('');
  });

  it('repairs a malformed palette', () => {
    expect(scene.presentation.palette.primary).toBe(DEFAULT_PALETTE.primary);
    expect(scene.presentation.palette.accent).toBe(DEFAULT_PALETTE.accent);
    // A bare hex is normalised and then lifted.
    expect(scene.presentation.palette.secondary).toBe(luminousHex('#001F3F'));
  });

  it('enforces every list cap', () => {
    expect(scene.answer.body).toHaveLength(LIMITS.maxParagraphs);
    expect(scene.answer.caveats).toHaveLength(LIMITS.maxCaveats);
    expect(Object.keys(scene.meta)).toHaveLength(LIMITS.maxMeta);
    expect(scene.modules).toHaveLength(LIMITS.maxModules);
    expect(scene.followups).toHaveLength(LIMITS.maxFollowups);
    expect(scene.modules[0].items).toHaveLength(LIMITS.maxTags);
  });

  it('drops meta entries with an empty key or value', () => {
    expect(Object.keys(scene.meta)).not.toContain('');
    expect(Object.keys(scene.meta)).not.toContain('d');
    expect(scene.meta.a).toBe('b');
  });

  it('backfills an empty answer headline from the subtitle', () => {
    expect(scene.answer.headline).toBe('42');
  });

  it('drops a spotlight whose label sanitises to empty', () => {
    expect(scene.spotlight).toBeUndefined();
  });

  it('drops non-object modules', () => {
    expect(scene.modules.every(m => typeof m === 'object')).toBe(true);
    expect(scene.modules.map(m => m.category)).not.toContain(undefined);
  });

  it('normalises a code body and keeps its language', () => {
    const code = scene.modules[1];
    expect(code.kind).toBe('code');
    expect(code.body).toBe('line1\nline2');
    expect(code.value).toBe('python');
  });

  it('drops weight, side and shape on a kind that does not use them', () => {
    expect(scene.modules[2].items).toEqual([{ label: 'L' }]);
  });

  it('clamps weight and allowlists shape on a panel', () => {
    expect(scene.modules[3].items).toEqual([{ label: 'L', weight: 100, shape: 'bar' }, { label: 'M' }]);
  });
});

describe('validatePreface', () => {
  it('returns null for a non-object', () => {
    expect(validatePreface('x')).toBeNull();
    expect(validatePreface(null)).toBeNull();
    expect(validatePreface(42)).toBeNull();
    expect(validatePreface([])).toBeNull();
  });

  it('never throws on a hostile payload and coerces every field', () => {
    const preface = validatePreface({
      intent: 'zzz',
      title: `P${NUL}`,
      layout: 'zzz',
      mood: 'zzz',
      palette: 'x',
      plan: ['a', 'b', 'c', 'd'],
    });
    expect(preface).toEqual({
      intent: 'explanation',
      title: 'P',
      layout: 'focus',
      mood: 'calm',
      palette: { ...DEFAULT_PALETTE },
      plan: ['a', 'b', 'c'],
    });
  });

  it('derives the layout from the intent when it is absent', () => {
    expect(validatePreface({ intent: 'howto', title: 'P' })?.layout).toBe('sequence');
    expect(validatePreface({ intent: 'comparison', title: 'P' })?.layout).toBe('split');
    expect(validatePreface({})?.layout).toBe('focus');
  });
});
