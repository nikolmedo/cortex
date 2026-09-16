import { describe, expect, it } from 'vitest';
import * as server from './Scene.js';
import * as client from '../../src/domain/Scene';

/**
 * `server/domain/Scene.ts` and `src/domain/Scene.ts` duplicate the contract
 * constants and the sanitizers nearly line for line. This file is the guard
 * against the drift that duplication invites: both halves get identical input
 * and must produce identical output.
 *
 * It lives under `server/` because `tsconfig.app.json` is a composite project
 * that refuses to typecheck files outside `src`; only a server-side test file
 * can import both twins.
 */

const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

describe('shared constant tables', () => {
  const tables = [
    'VALID_TYPES', 'SCENE_INTENTS', 'SCENE_LAYOUTS', 'SCENE_MOODS', 'SCENE_MOTIFS', 'SCENE_DENSITIES',
    'FACT_KINDS', 'SPOTLIGHT_KINDS', 'ITEM_SIDES', 'MODULE_SLOTS', 'MODULE_SPANS', 'MODULE_EMPHASES',
    'MODULE_TONES', 'MODULE_REVEALS', 'ITEM_SHAPES',
  ] as const;

  it.each(tables)('%s is identical in both mirrors', name => {
    expect(client[name]).toEqual(server[name]);
  });

  it('LIMITS is identical in both mirrors', () => {
    expect(client.LIMITS).toEqual(server.LIMITS);
  });

  it('DEFAULT_PALETTE is identical in both mirrors', () => {
    expect(client.DEFAULT_PALETTE).toEqual(server.DEFAULT_PALETTE);
  });

  it('LAYOUT_BY_INTENT is identical in both mirrors', () => {
    expect(client.LAYOUT_BY_INTENT).toEqual(server.LAYOUT_BY_INTENT);
  });

  it('SCENE_VERSION is identical in both mirrors', () => {
    expect(client.SCENE_VERSION).toBe(server.SCENE_VERSION);
  });

  it('DEFAULT_PRESENTATION matches the server defaults', () => {
    expect(client.DEFAULT_PRESENTATION).toEqual({
      layout: 'focus',
      mood: 'calm',
      motif: 'flow',
      density: 'balanced',
      palette: server.DEFAULT_PALETTE,
    });
  });
});

describe('sanitizer parity', () => {
  const textCases: Array<[string, number]> = [
    ['hello', 10],
    ['  a   b\n\tc  ', 50],
    ['<script>alert(1)</script>', 50],
    [`a${NUL}b${BEL}c`, 50],
    ['the quick brown fox jumps', 12],
    ['abcdefghijklmnop', 6],
    ['abcdef', 1],
    ['abcdef', 0],
    ['alpha beta, gamma delta', 14],
    ['x'.repeat(200), 40],
    ['', 10],
  ];

  it.each(textCases)('sanitizeText(%j, %i) matches', (input, max) => {
    expect(client.sanitizeText(input, max)).toBe(server.sanitizeText(input, max));
  });

  it.each(textCases)('truncateText(%j, %i) matches', (input, max) => {
    expect(client.truncateText(input, max)).toBe(server.truncateText(input, max));
  });

  const codeCases: Array<[string, number]> = [
    ['a\r\nb\rc', 100],
    ['\n\n  const a = 1;\n  <b>\n\n', 100],
    [`a${NUL}\tb${BEL}`, 100],
    ['abcdefghij', 4],
    ['   \n\t leading', 100],
    ['', 10],
  ];

  it.each(codeCases)('sanitizeCode(%j, %i) matches', (input, max) => {
    expect(client.sanitizeCode(input, max)).toBe(server.sanitizeCode(input, max));
  });

  const urlCases: unknown[] = [
    'https://a.com/x?y=1#z',
    '  https://a.com  ',
    'http://a.com',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'https://a.com/ x',
    '',
    '   ',
    `https://a.com/${'x'.repeat(2100)}`,
    42,
    null,
    undefined,
    {},
  ];

  it.each(urlCases.map(v => [v] as [unknown]))('safeHttpsUrl(%j) matches', input => {
    expect(client.safeHttpsUrl(input)).toBe(server.safeHttpsUrl(input));
  });

  const hexCases: unknown[] = ['7FD8FF', '#7FD8FF', '#7fd8ff', '001F3F', 'zzz', '#GGGGGG', '#7FD8F', 42, null, undefined];

  it.each(hexCases.map(v => [v] as [unknown]))('normalizeHex(%j) matches', input => {
    expect(client.normalizeHex(input)).toEqual(server.normalizeHex(input));
  });

  it.each(hexCases.map(v => [v] as [unknown]))('isHex(%j) matches', input => {
    expect(client.isHex(input)).toBe(server.isHex(input));
  });

  it.each(hexCases.map(v => [v] as [unknown]))('hexOr(%j) matches', input => {
    expect(client.hexOr(input, client.DEFAULT_PALETTE.primary)).toBe(server.hexOr(input, server.DEFAULT_PALETTE.primary));
  });

  const luminousCases = [
    '#7FD8FF', '#8C9EFF', '#5EF2C2', '#808080', '#000000', '#ffffff',
    '#001F3F', '#8B0000', '#123456', '#ff0000', '#010203', '#7a7a7a',
  ];

  it.each(luminousCases)('luminousHex(%s) matches', input => {
    expect(client.luminousHex(input)).toBe(server.luminousHex(input));
  });
});

describe('kind helper parity', () => {
  it('itemCap matches for every kind', () => {
    for (const kind of server.FACT_KINDS) {
      expect(client.itemCap(kind)).toBe(server.itemCap(kind));
      expect(client.kindUsesSide(kind)).toBe(server.kindUsesSide(kind));
      expect(client.kindUsesWeight(kind)).toBe(server.kindUsesWeight(kind));
      expect(client.kindUsesShape(kind)).toBe(server.kindUsesShape(kind));
    }
  });

  it('itemShape matches for every kind and candidate value', () => {
    const values: unknown[] = [...server.ITEM_SHAPES, 'nope', '', 42, null, undefined, {}];
    for (const kind of server.FACT_KINDS) {
      for (const value of values) {
        expect(client.itemShape(kind, value)).toBe(server.itemShape(kind, value));
      }
    }
  });
});

describe('entry-point parity on a shared payload', () => {
  const payload = {
    title: `Ti${NUL}tle <b>`,
    intent: 'nonsense',
    type: 'wizard',
    subtitle: 42,
    summary: 'A plain summary.',
    image_url: 'javascript:alert(1)',
    presentation: {
      layout: 'hologram',
      mood: 'angry',
      palette: { primary: 'red', secondary: '001F3F', accent: '#5EF2C2' },
    },
    answer: { headline: 'H', body: ['p1', 'p2'], caveats: ['c'] },
    spotlight: { kind: 'explosion', label: 'S', value: 'v' },
    modules: [
      { category: 'C', kind: 'tags', color: 'zzz', items: Array.from({ length: 20 }, (_, i) => ({ label: `t${i}` })) },
      { category: 'D', kind: 'code', body: 'line1\r\nline2', value: 'python', facts: ['f'] },
      { category: 'F', kind: 'panel', items: [{ label: 'L', weight: 500, shape: 'bar' }, { label: 'M', shape: 'nope' }] },
    ],
    followups: ['a', 'b'],
    sources: [{ title: 'S', url: 'http://insecure.com' }, { title: 'T', url: 'https://ok.com' }],
  };

  it('validateScene and sanitizeScene agree', () => {
    expect(client.sanitizeScene(payload)).toEqual(server.validateScene(payload));
  });

  it('validatePreface and sanitizePreface agree', () => {
    const preface = { intent: 'howto', title: 'P', layout: 'zzz', mood: 'kinetic', palette: 'x', plan: ['a', 'b', 'c', 'd'] };
    expect(client.sanitizePreface(preface)).toEqual(server.validatePreface(preface));
  });

  it('both reject a payload with no title', () => {
    expect(() => client.sanitizeScene({ modules: [] })).toThrow();
    expect(() => server.validateScene({ modules: [] })).toThrow();
  });
});
