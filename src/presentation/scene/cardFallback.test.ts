import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION, SCENE_MOODS, VARIANTS_BY_KIND,
  type FactKind, type SceneModule, type SceneMood,
} from '../../domain/Scene';
import { fillCardGrammar, fillTypeScale } from './cardFallback';

const KINDS: FactKind[] = ['stats', 'list', 'timeline', 'chart', 'keyvalue', 'quote', 'steps', 'tags'];

function mod(index: number, kind: FactKind = KINDS[index % KINDS.length], extra: Partial<SceneModule> = {}): SceneModule {
  return {
    category: `M${index}`,
    color: '#7FD8FF',
    image_query: '',
    kind,
    facts: ['one', 'two', 'three'],
    ...extra,
  };
}

const plain = (n: number) => Array.from({ length: n }, (_, i) => mod(i));
const SEEDS = Array.from({ length: 40 }, (_, i) => `query number ${i}`);

describe('fillCardGrammar', () => {
  it('is deterministic for the same input', () => {
    const modules = plain(6);
    for (const mood of SCENE_MOODS) {
      expect(fillCardGrammar(modules, mood, 'sourdough')).toEqual(fillCardGrammar(modules, mood, 'sourdough'));
    }
  });

  it('gives different queries different combinations', () => {
    const modules = plain(5);
    const looks = new Set(SEEDS.map(seed => JSON.stringify(
      fillCardGrammar(modules, 'calm', seed).map(m => [m.surface, m.corner, m.header, m.pattern, m.variant]),
    )));
    expect(looks.size).toBeGreaterThan(SEEDS.length * 0.8);
  });

  it('leaves a module with any model-set field untouched', () => {
    const styled = [
      mod(0, 'stats', { surface: 'bare' }),
      mod(1, 'list', { corner: 'notch' }),
      mod(2, 'chart', { header: 'none' }),
      mod(3, 'tags', { pattern: 'none' }),
      mod(4, 'quote', { variant: 'stack' }),
    ];
    const out = fillCardGrammar([...styled, mod(5)], 'kinetic', 'seed');
    styled.forEach((m, i) => expect(out[i]).toBe(m));
    expect(out[5].surface).toBeDefined();
  });

  it('only ever draws a variant the kind allows, and never sets size', () => {
    for (const mood of SCENE_MOODS) {
      for (const seed of SEEDS) {
        for (const m of fillCardGrammar(plain(8), mood, seed)) {
          expect('size' in m).toBe(false);
          const allowed = VARIANTS_BY_KIND[m.kind];
          if (allowed) expect(allowed).toContain(m.variant);
          else expect('variant' in m).toBe(false);
        }
      }
    }
  });

  it('draws at least two surfaces and at most one inverted card per scene', () => {
    for (const mood of SCENE_MOODS) {
      for (const seed of SEEDS) {
        for (const n of [2, 3, 5, 8]) {
          const modules = plain(n).map((m, i) => (i === n - 1 ? { ...m, emphasis: 'lead' as const } : m));
          const out = fillCardGrammar(modules, mood, seed);
          expect(new Set(out.map(m => m.surface)).size).toBeGreaterThanOrEqual(2);
          expect(new Set(out.map(m => m.header)).size).toBeGreaterThanOrEqual(2);
          expect(out.filter(m => m.surface === 'inverted').length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps visible patterns to roughly a quarter of the cards', () => {
    let cards = 0;
    let patterned = 0;
    for (const mood of SCENE_MOODS) {
      for (const seed of SEEDS) {
        for (const m of fillCardGrammar(plain(6), mood, seed)) {
          cards += 1;
          if (m.pattern && m.pattern !== 'none') patterned += 1;
        }
      }
    }
    expect(patterned / cards).toBeGreaterThan(0.15);
    expect(patterned / cards).toBeLessThan(0.35);
  });

  it('follows the mood', () => {
    for (const seed of SEEDS) {
      for (const m of fillCardGrammar(plain(6), 'archival', seed)) {
        expect(m.corner).toBe('square');
        expect(['outline', 'bare', 'solid']).toContain(m.surface);
      }
    }
  });

  it('gives the lead card the mood\'s most prominent treatment', () => {
    const lead: Record<SceneMood, string[]> = {
      calm: ['bleed', 'solid'],
      archival: ['solid', 'outline'],
      volatile: ['inverted', 'glass', 'solid'],
      kinetic: ['inverted', 'bleed', 'glass'],
    };
    for (const mood of SCENE_MOODS) {
      const out = fillCardGrammar([mod(0, 'stats', { emphasis: 'lead' }), mod(1)], mood, 'lead');
      expect(lead[mood]).toContain(out[0].surface);
      expect(out[0].variant).toBe('hero');
    }
  });

  it('keeps earlier choices when modules are appended while streaming', () => {
    const all = plain(8).map((m, i) => (i === 4 ? { ...m, emphasis: 'lead' as const } : i === 2 ? { ...m, surface: 'inverted' as const } : m));
    for (const mood of SCENE_MOODS) {
      for (const seed of SEEDS) {
        const full = fillCardGrammar(all, mood, seed);
        for (let k = 1; k <= all.length; k += 1) {
          expect(fillCardGrammar(all.slice(0, k), mood, seed)).toEqual(full.slice(0, k));
        }
      }
    }
  });

  it('skips cards with nothing to draw', () => {
    const empty = { ...mod(0), facts: [] };
    const out = fillCardGrammar([empty, mod(1)], 'calm', 'seed');
    expect(out[0]).toBe(empty);
  });
});

describe('fillCardGrammar chart variants', () => {
  const chart = (labels: string[]) => mod(0, 'chart', { items: labels.map((label, i) => ({ label, weight: 20 + i * 10 })) });
  const short = chart(['2019', '2020', '2021', '2022', '2023', '2024']);
  const long = chart(['North America', 'Western Europe', 'Southeast Asia']);
  const variant = (m: SceneModule, seed: string) => fillCardGrammar([m], 'kinetic', seed)[0].variant;

  it('never assigns a line or area to data that reads only as bars', () => {
    for (const seed of SEEDS) expect(['bars', 'dots']).toContain(variant(long, seed));
  });

  it('still assigns lines where the data carries one', () => {
    expect(SEEDS.some(seed => ['line', 'area'].includes(variant(short, seed) ?? ''))).toBe(true);
  });

  it('substitutes bars for an unreadable line pick and leaves every other pick alone', () => {
    for (const seed of SEEDS) {
      const readable = variant(short, seed);
      const expected = readable === 'line' || readable === 'area' ? 'bars' : readable;
      expect(variant(long, seed)).toBe(expected);
    }
  });
});

describe('fillTypeScale', () => {
  it('keeps a scale the model chose', () => {
    const presentation = { ...DEFAULT_PRESENTATION, typeScale: 'monumental' as const };
    expect(fillTypeScale(presentation, 'calm', 'seed')).toBe(presentation);
  });

  it('derives a stable scale from the seed and mood when none is set', () => {
    const a = fillTypeScale(DEFAULT_PRESENTATION, 'kinetic', 'seed');
    expect(a.typeScale).toBeDefined();
    expect(fillTypeScale(DEFAULT_PRESENTATION, 'kinetic', 'seed')).toEqual(a);
    const scales = new Set(SEEDS.map(seed => fillTypeScale(DEFAULT_PRESENTATION, 'kinetic', seed).typeScale));
    expect(scales.size).toBeGreaterThan(1);
  });
});
