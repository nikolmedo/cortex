import { describe, expect, it } from 'vitest';
import { APPLET_SIZE_MESSAGE } from './appletDocument';
import { APPLET_MAX_HEIGHT, APPLET_MIN_HEIGHT, appletFrameAttributes, clampAppletHeight, readAppletSize } from './appletSandbox';

describe('appletFrameAttributes', () => {
  const attrs = appletFrameAttributes('Colour picker', '<!doctype html>');

  it('sandboxes the frame with scripts only', () => {
    expect(attrs.sandbox).toBe('allow-scripts');
    for (const token of ['allow-same-origin', 'allow-top-navigation', 'allow-popups', 'allow-forms', 'allow-modals']) {
      expect(attrs.sandbox).not.toContain(token);
    }
  });

  it('grants only clipboard writes, sends no referrer and names the frame', () => {
    expect(attrs.allow).toBe('clipboard-write');
    expect(attrs.referrerPolicy).toBe('no-referrer');
    expect(attrs.title).toBe('Colour picker');
    expect(attrs.srcDoc).toBe('<!doctype html>');
    expect(Object.keys(attrs).sort()).toEqual(['allow', 'referrerPolicy', 'sandbox', 'srcDoc', 'title']);
  });
});

describe('clampAppletHeight', () => {
  it('keeps the frame between its minimum and maximum height', () => {
    expect(clampAppletHeight(40)).toBe(APPLET_MIN_HEIGHT);
    expect(clampAppletHeight(480.2)).toBe(481);
    expect(clampAppletHeight(10_000)).toBe(APPLET_MAX_HEIGHT);
    expect(APPLET_MIN_HEIGHT).toBe(160);
    expect(APPLET_MAX_HEIGHT).toBe(900);
  });
});

describe('readAppletSize', () => {
  const frame = {} as Window;
  const other = {} as Window;

  it('accepts a size message from this frame and clamps it', () => {
    expect(readAppletSize({ source: frame, data: { type: APPLET_SIZE_MESSAGE, height: 512 } }, frame)).toBe(512);
    expect(readAppletSize({ source: frame, data: { type: APPLET_SIZE_MESSAGE, height: 5 } }, frame)).toBe(APPLET_MIN_HEIGHT);
    expect(readAppletSize({ source: frame, data: { type: APPLET_SIZE_MESSAGE, height: 99_999 } }, frame)).toBe(APPLET_MAX_HEIGHT);
  });

  it('ignores messages from any other window, or with no frame mounted', () => {
    expect(readAppletSize({ source: other, data: { type: APPLET_SIZE_MESSAGE, height: 512 } }, frame)).toBeNull();
    expect(readAppletSize({ source: null, data: { type: APPLET_SIZE_MESSAGE, height: 512 } }, frame)).toBeNull();
    expect(readAppletSize({ source: frame, data: { type: APPLET_SIZE_MESSAGE, height: 512 } }, null)).toBeNull();
    expect(readAppletSize({ source: frame, data: { type: APPLET_SIZE_MESSAGE, height: 512 } }, undefined)).toBeNull();
  });

  it('ignores payloads of the wrong shape', () => {
    for (const data of [null, 'resize', 512, { type: 'other', height: 512 }, { type: APPLET_SIZE_MESSAGE }, { type: APPLET_SIZE_MESSAGE, height: '512' },
      { type: APPLET_SIZE_MESSAGE, height: Number.NaN }, { type: APPLET_SIZE_MESSAGE, height: Infinity }]) {
      expect(readAppletSize({ source: frame, data }, frame)).toBeNull();
    }
  });
});
