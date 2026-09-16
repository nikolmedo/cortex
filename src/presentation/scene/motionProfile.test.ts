import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  SCENE_DENSITIES,
  SCENE_LAYOUTS,
  SCENE_MOODS,
  type ScenePalette,
  type ScenePresentation,
} from '../../domain/Scene';
import { STAGGER_BY_DENSITY, motionFor, staggerStep } from './motionProfile';

const palette: ScenePalette = { ...DEFAULT_PALETTE };

function presentation(over: Partial<ScenePresentation> = {}): ScenePresentation {
  return { layout: 'focus', mood: 'calm', motif: 'flow', density: 'balanced', palette, ...over };
}

/** Every mood/layout/density combination the validated enums allow. */
const ALL = SCENE_MOODS.flatMap(mood =>
  SCENE_LAYOUTS.flatMap(layout =>
    SCENE_DENSITIES.map(density => ({ mood, layout, density })),
  ),
);

const MIN_DUR_MS = 140;
const MAX_DUR_MS = 900;
/** The only entrance families the layout table can produce. */
const ENTER_FAMILIES = ['materialize', 'edge', 'unfurl', 'settle'];

describe('staggerStep', () => {
  it('reads the density table for every non-mosaic layout', () => {
    for (const layout of SCENE_LAYOUTS) {
      if (layout === 'mosaic') continue;
      for (const density of SCENE_DENSITIES) {
        expect(staggerStep(presentation({ layout, density }))).toBe(STAGGER_BY_DENSITY[density]);
      }
    }
  });

  it('scales a mosaic by 0.7', () => {
    expect(staggerStep(presentation({ layout: 'mosaic', density: 'sparse' }))).toBe(56);
    expect(staggerStep(presentation({ layout: 'mosaic', density: 'balanced' }))).toBe(42);
    expect(staggerStep(presentation({ layout: 'mosaic', density: 'dense' }))).toBe(28);
  });

  it('always returns a positive integer', () => {
    for (const combo of ALL) {
      const step = staggerStep(presentation(combo));
      expect(Number.isInteger(step)).toBe(true);
      expect(step).toBeGreaterThan(0);
    }
  });
});

describe('motionFor', () => {
  it('clamps every duration into [140, 900] ms', () => {
    for (const combo of ALL) {
      const vars = motionFor(presentation(combo));
      for (const key of ['--dur-fast', '--dur-base', '--dur-slow'] as const) {
        expect(vars[key]).toMatch(/^\d+ms$/);
        const ms = Number.parseInt(vars[key], 10);
        expect(ms).toBeGreaterThanOrEqual(MIN_DUR_MS);
        expect(ms).toBeLessThanOrEqual(MAX_DUR_MS);
      }
    }
  });

  it('orders the three durations fast <= base <= slow', () => {
    for (const combo of ALL) {
      const vars = motionFor(presentation(combo));
      const fast = Number.parseInt(vars['--dur-fast'], 10);
      const base = Number.parseInt(vars['--dur-base'], 10);
      const slow = Number.parseInt(vars['--dur-slow'], 10);
      expect(fast).toBeLessThanOrEqual(base);
      expect(base).toBeLessThanOrEqual(slow);
    }
  });

  it('emits only allowlisted values, so no model string can reach CSS', () => {
    for (const combo of ALL) {
      const vars = motionFor(presentation(combo));
      expect(vars['--ease']).toMatch(/^cubic-bezier\([\d.,\s-]+\)$/);
      expect(ENTER_FAMILIES).toContain(vars['--enter']);
      expect(vars['--rise']).toMatch(/^\d+px$/);
      expect(vars['--reveal-blur']).toMatch(/^\d+px$/);
      expect(vars['--enter-scale']).toMatch(/^[\d.]+$/);
      expect(Number(vars['--enter-scale'])).toBeGreaterThan(0);
      expect(vars['--stagger']).toBe(`${staggerStep(presentation(combo))}ms`);
    }
  });

  it('returns exactly the documented set of custom properties', () => {
    expect(Object.keys(motionFor(presentation())).sort()).toEqual([
      '--dur-base', '--dur-fast', '--dur-slow', '--ease', '--enter',
      '--enter-scale', '--reveal-blur', '--rise', '--stagger',
    ].sort());
  });

  it('gives every mood a distinct base duration', () => {
    const bases = SCENE_MOODS.map(mood => motionFor(presentation({ mood }))['--dur-base']);
    expect(new Set(bases).size).toBe(SCENE_MOODS.length);
  });

  it('picks the entrance family from the layout, not the mood', () => {
    const byLayout = Object.fromEntries(
      SCENE_LAYOUTS.map(layout => [layout, motionFor(presentation({ layout }))['--enter']]),
    );
    expect(byLayout).toEqual({
      focus: 'materialize',
      dossier: 'materialize',
      split: 'edge',
      sequence: 'unfurl',
      mosaic: 'settle',
    });
    for (const mood of SCENE_MOODS) {
      expect(motionFor(presentation({ layout: 'split', mood }))['--enter']).toBe('edge');
    }
  });
});
