import { APPLET_SIZE_MESSAGE } from './appletDocument';

/*
 * The attributes and the message guard of the applet iframe, kept out of the
 * component so the sandbox can be pinned by a test without a DOM.
 *
 * Never add allow-same-origin: with allow-scripts it lets the frame remove its
 * own sandbox. allow-top-navigation, allow-popups, allow-forms and allow-modals
 * stay out too, which is what makes navigation, window.open, form submission
 * and alert() inert inside the frame.
 */
export const APPLET_SANDBOX = 'allow-scripts';

/**
 * A colour picker, a converter or a generator is only useful if its output can
 * be copied. clipboard-write grants writing only, never reading, and browsers
 * still require a user gesture inside the frame for it. Whether a browser honours
 * it for an opaque-origin srcdoc frame varies (Chromium in the desktop pane still
 * rejected writeText), so the applet prompt also requires the select-and-
 * execCommand('copy') fallback, which is what actually copied there.
 */
export const APPLET_ALLOW = 'clipboard-write';

export const APPLET_MIN_HEIGHT = 160;
export const APPLET_MAX_HEIGHT = 900;
/** Used until the frame reports its own height. */
export const APPLET_INITIAL_HEIGHT = 360;

export interface AppletFrameAttributes {
  sandbox: string;
  allow: string;
  referrerPolicy: 'no-referrer';
  title: string;
  srcDoc: string;
}

export function appletFrameAttributes(title: string, srcDoc: string): AppletFrameAttributes {
  return { sandbox: APPLET_SANDBOX, allow: APPLET_ALLOW, referrerPolicy: 'no-referrer', title, srcDoc };
}

export function clampAppletHeight(height: number): number {
  return Math.min(APPLET_MAX_HEIGHT, Math.max(APPLET_MIN_HEIGHT, Math.ceil(height)));
}

/**
 * The clamped height from a size message, or null when the message is not one.
 * The source check is the guard: a sandboxed frame's origin is the opaque
 * "null", so only the identity of its window says who sent it.
 */
export function readAppletSize(
  event: { source: unknown; data: unknown },
  frame: Window | null | undefined,
): number | null {
  if (!frame || event.source !== frame) return null;
  const data = event.data as { type?: unknown; height?: unknown } | null;
  if (typeof data !== 'object' || data === null || data.type !== APPLET_SIZE_MESSAGE) return null;
  return typeof data.height === 'number' && Number.isFinite(data.height) ? clampAppletHeight(data.height) : null;
}
