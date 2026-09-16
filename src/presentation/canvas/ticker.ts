/*
 * One requestAnimationFrame loop shared by every canvas. It stops when nobody
 * is subscribed or the tab is hidden, and resumes on the next subscription or
 * when the tab becomes visible again.
 */

export type TickFn = (now: number, dt: number) => void;

const subscribers = new Set<TickFn>();
let frame = 0;
let last = 0;

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function loop(now: number) {
  const dt = last === 0 ? 16 : Math.min(64, now - last);
  last = now;
  for (const fn of subscribers) fn(now, dt);
  frame = subscribers.size > 0 && isVisible() ? requestAnimationFrame(loop) : 0;
  if (frame === 0) last = 0;
}

function ensureRunning() {
  if (frame === 0 && subscribers.size > 0 && isVisible()) frame = requestAnimationFrame(loop);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (isVisible()) {
      ensureRunning();
    } else if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    }
  });
}

export function subscribeTick(fn: TickFn): () => void {
  subscribers.add(fn);
  ensureRunning();
  return () => {
    subscribers.delete(fn);
  };
}

/** Viewport-based device tier for particle budgets and DPR caps. */
export function deviceTier(): 'mobile' | 'tablet' | 'desktop' {
  const w = typeof window === 'undefined' ? 1440 : window.innerWidth;
  return w < 768 ? 'mobile' : w < 1280 ? 'tablet' : 'desktop';
}

/** Sizes the backing store for crisp drawing with a capped pixel ratio; returns the ratio used. */
export function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, dprCap: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
}
