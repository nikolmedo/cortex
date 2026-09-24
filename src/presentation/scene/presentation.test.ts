import { describe, expect, it } from 'vitest';
import type { Turn } from '../../application/useCortex';
import { DEFAULT_PRESENTATION, sanitizePreface, sanitizeScene } from '../../domain/Scene';
import { turnPresentation } from './presentation';

function turn(over: Partial<Turn> = {}): Turn {
  return { id: '1', query: 'q', lang: 'en', status: 'thinking', startedAt: 0, ...over };
}

describe('turnPresentation', () => {
  it('falls back to the defaults when there is neither scene nor preface', () => {
    expect(turnPresentation(undefined)).toBe(DEFAULT_PRESENTATION);
    expect(turnPresentation(turn())).toBe(DEFAULT_PRESENTATION);
  });

  it('uses the scene presentation once a scene exists', () => {
    const scene = sanitizeScene({
      title: 'T',
      modules: [],
      presentation: { layout: 'mosaic', mood: 'kinetic', motif: 'grid', density: 'dense', palette: {} },
    });
    expect(turnPresentation(turn({ scene }))).toBe(scene.presentation);
  });

  it('seeds layout, mood and palette from the preface while the scene is pending', () => {
    const preface = sanitizePreface({ intent: 'comparison', title: 'P', mood: 'volatile' });
    expect(preface).not.toBeNull();
    const out = turnPresentation(turn({ status: 'streaming', preface: preface! }));
    expect(out).toEqual({
      ...DEFAULT_PRESENTATION,
      layout: 'split',
      mood: 'volatile',
      palette: preface!.palette,
    });
    // Motif and density stay at the defaults: the preface does not carry them.
    expect(out.motif).toBe(DEFAULT_PRESENTATION.motif);
    expect(out.density).toBe(DEFAULT_PRESENTATION.density);
  });

  it('prefers the scene over the preface when both are present', () => {
    const scene = sanitizeScene({
      title: 'T',
      modules: [],
      presentation: { layout: 'dossier', mood: 'archival', motif: 'rings', density: 'sparse', palette: {} },
    });
    const preface = sanitizePreface({ intent: 'howto', title: 'P', mood: 'kinetic' });
    expect(turnPresentation(turn({ scene, preface: preface! }))).toBe(scene.presentation);
  });

  it('carries the scene type scale through, and the preface has none', () => {
    const scene = sanitizeScene({
      title: 'T',
      modules: [],
      presentation: { layout: 'mosaic', mood: 'volatile', typeScale: 'monumental', palette: {} },
    });
    expect(turnPresentation(turn({ scene })).typeScale).toBe('monumental');
    const preface = sanitizePreface({ intent: 'analysis', title: 'P', typeScale: 'monumental' });
    expect(turnPresentation(turn({ status: 'streaming', preface: preface! })).typeScale).toBeUndefined();
  });

  it('drops an unknown type scale so the default scale applies', () => {
    const scene = sanitizeScene({ title: 'T', modules: [], presentation: { typeScale: 'gigantic' } });
    expect(turnPresentation(turn({ scene })).typeScale).toBeUndefined();
    expect('typeScale' in turnPresentation(turn({ scene }))).toBe(false);
  });
});
