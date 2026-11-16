import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, DEFAULT_PRESENTATION } from '../../domain/Scene';
import { sceneCssVars } from './sceneTokens';

function varsFor(palette: { primary: string; secondary: string; accent: string }) {
  return sceneCssVars({ ...DEFAULT_PRESENTATION, palette });
}

describe('sceneCssVars palette', () => {
  it('passes the primary through as the signal colour', () => {
    const vars = varsFor({ primary: '#ff0055', secondary: '#00ff00', accent: '#0000ff' });
    expect(vars['--scene-primary']).toBe('#ff0055');
  });

  it('mutes the secondary and the accent toward fixed neutrals', () => {
    const vars = varsFor({ primary: '#ff0055', secondary: '#00ff00', accent: '#0000ff' });
    expect(vars['--scene-secondary']).toBe('color-mix(in srgb, #00ff00 30%, #b4c0c6)');
    expect(vars['--scene-accent']).toBe('color-mix(in srgb, #0000ff 22%, #e6ecee)');
  });

  it('never lets an invalid colour string into the mix', () => {
    const vars = varsFor({ primary: 'red', secondary: 'url(x)', accent: '#12345' });
    expect(vars['--scene-primary']).toBe(DEFAULT_PALETTE.primary);
    expect(vars['--scene-secondary']).toBe(`color-mix(in srgb, ${DEFAULT_PALETTE.secondary} 30%, #b4c0c6)`);
    expect(vars['--scene-accent']).toBe(`color-mix(in srgb, ${DEFAULT_PALETTE.accent} 22%, #e6ecee)`);
  });
});
