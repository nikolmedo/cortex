import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  SCENE_DENSITIES,
  SCENE_LAYOUTS,
  SCENE_MOODS,
  type ScenePalette,
  type ScenePresentation,
} from '../../domain/Scene';
import {
  CASCADE_CAP_MS, ENTER_FAMILIES, STAGGER_BY_DENSITY, enterFamily, familyVars, motionFor, staggerStep,
} from './motionProfile';

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
/** The only keyframes and traces the family table can emit. */
const ENTER_KEYFRAMES = ['materialize', 'wipeIn', 'unfoldIn', 'scanIn', 'lockIn'];
const TRACES = ['none', 'scanLine', 'lockTrace'];

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
      expect(ENTER_KEYFRAMES).toContain(vars['--enter']);
      expect(TRACES).toContain(vars['--enter-scan']);
      expect(TRACES).toContain(vars['--enter-lock']);
      expect(vars['--rise']).toMatch(/^\d+px$/);
      expect(vars['--cascade']).toBe(`${CASCADE_CAP_MS}ms`);
      expect(vars['--enter-scale']).toMatch(/^[\d.]+$/);
      expect(Number(vars['--enter-scale'])).toBeGreaterThan(0);
      expect(vars['--stagger']).toBe(`${staggerStep(presentation(combo))}ms`);
    }
  });

  it('returns exactly the documented set of custom properties', () => {
    expect(Object.keys(motionFor(presentation())).sort()).toEqual([
      '--cascade', '--dur-base', '--dur-fast', '--dur-slow', '--ease', '--enter',
      '--enter-lock', '--enter-scale', '--enter-scan', '--rise', '--stagger',
    ].sort());
  });

  it('gives every mood a distinct base duration', () => {
    const bases = SCENE_MOODS.map(mood => motionFor(presentation({ mood }))['--dur-base']);
    expect(new Set(bases).size).toBe(SCENE_MOODS.length);
  });

  it('lets both the layout and the mood change the entrance family', () => {
    expect(enterFamily(presentation({ layout: 'dossier', mood: 'calm' }))).toBe('unfold');
    expect(enterFamily(presentation({ layout: 'dossier', mood: 'kinetic' }))).toBe('lock');
    expect(enterFamily(presentation({ layout: 'dossier', mood: 'archival' }))).toBe('scan');
    expect(enterFamily(presentation({ layout: 'split', mood: 'kinetic' }))).toBe('wipe');
    expect(enterFamily(presentation({ layout: 'focus', mood: 'calm' }))).toBe('rise');
    // Every layout reads at least two families across the moods, and every mood across the layouts.
    for (const layout of SCENE_LAYOUTS) {
      expect(new Set(SCENE_MOODS.map(mood => enterFamily(presentation({ layout, mood })))).size).toBeGreaterThan(1);
    }
    for (const mood of SCENE_MOODS.filter(m => m !== 'archival')) {
      expect(new Set(SCENE_LAYOUTS.map(layout => enterFamily(presentation({ layout, mood })))).size).toBeGreaterThan(1);
    }
  });

  it('emits the family vars of the chosen family, traces included', () => {
    for (const combo of ALL) {
      const p = presentation(combo);
      const vars = motionFor(p);
      const family = familyVars(enterFamily(p));
      for (const key of ['--enter', '--enter-scan', '--enter-lock'] as const) expect(vars[key]).toBe(family[key]);
    }
  });

  it('names every trace explicitly, so an override never inherits one', () => {
    for (const family of Object.values(ENTER_FAMILIES)) {
      expect(TRACES).toContain(family.scan);
      expect(TRACES).toContain(family.lock);
    }
    expect(ENTER_FAMILIES.scan.scan).toBe('scanLine');
    expect(ENTER_FAMILIES.lock.lock).toBe('lockTrace');
  });
});
