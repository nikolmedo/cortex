import { describe, expect, it } from 'vitest';
import { APPLET_THEME_VARS } from '../../../domain/Scene';
import { APPLET_CSP, APPLET_SIZE_MESSAGE, APPLET_THEME, buildAppletDocument } from './appletDocument';

const HTML = '<div class="tool"><label for="x">Hue</label><input id="x" type="range"></div>\n<script>if (1 < 2) {}</script>';

describe('APPLET_CSP', () => {
  it('blocks every network fetch and allows only inline code and data media', () => {
    expect(APPLET_CSP).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; "
      + "media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'",
    );
  });
});

describe('buildAppletDocument', () => {
  const doc = buildAppletDocument(HTML, 'es');

  it('is a full document whose policy meta comes before anything the applet wrote', () => {
    expect(doc.startsWith('<!doctype html><html lang="es"><head><meta charset="utf-8">')).toBe(true);
    const meta = `<meta http-equiv="Content-Security-Policy" content="${APPLET_CSP}">`;
    expect(doc).toContain(meta);
    expect(doc.indexOf(meta)).toBeLessThan(doc.indexOf(HTML));
    expect(doc.indexOf('</head>')).toBeLessThan(doc.indexOf(HTML));
  });

  it('places the applet markup verbatim, once, inside body', () => {
    expect(doc.split(HTML)).toHaveLength(2);
    expect(doc.endsWith(`<body>${HTML}</body></html>`)).toBe(true);
  });

  it('runs the size reporter before the applet, so an unclosed tag cannot swallow it', () => {
    const reporter = doc.indexOf(APPLET_SIZE_MESSAGE);
    expect(reporter).toBeGreaterThan(-1);
    expect(reporter).toBeLessThan(doc.indexOf('<body>'));
    expect(doc).toContain('ResizeObserver');
    expect(doc).toContain('parent.postMessage');
  });

  it('defines every theme variable the applet prompt lists, with the host values', () => {
    expect(Object.keys(APPLET_THEME)).toEqual([...APPLET_THEME_VARS]);
    for (const name of APPLET_THEME_VARS) expect(doc).toContain(`${name}:${APPLET_THEME[name]};`);
    expect(APPLET_THEME['--bg']).toBe('#06080a');
    expect(APPLET_THEME['--paper']).toBe('#eef2f3');
    expect(APPLET_THEME['--signal']).toBe('#6fc3ff');
    expect(APPLET_THEME['--line']).toBe('rgb(216 228 234 / 0.14)');
  });

  it('uses system font stacks only, since the policy blocks web fonts', () => {
    expect(APPLET_THEME['--font-body']).not.toMatch(/Barlow|Saira|url\(/);
    expect(APPLET_THEME['--font-mono']).not.toMatch(/JetBrains|url\(/);
  });

  it('sets the base styles: dark scheme, border-box, square controls and a visible focus ring', () => {
    expect(doc).toContain('color-scheme:dark');
    expect(doc).toContain('box-sizing:border-box');
    expect(doc).toContain('border-radius:0');
    expect(doc).toContain(':focus-visible{outline:1px solid var(--paper);outline-offset:3px}');
  });
});
