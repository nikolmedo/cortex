import { useLayoutEffect, useRef, type RefObject } from 'react';

/*
 * A tiny FLIP for the module grid. Positions come from the offset chain, which
 * ignores transforms, so a card that is itself mid-entrance never reads as moved.
 * Only translation is animated: scaling a card whose width changed would squash
 * its text, and the reflow inside it is instant anyway.
 */

const FLIP_MS = 250;
const FLIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface Point {
  x: number;
  y: number;
}

function layoutOffset(node: HTMLElement): Point {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = node; n; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

/**
 * Whenever `arrangement` changes, every `[data-flip]` element under `root` that
 * was already on screen slides from where it was to where it now is. The first
 * render, a changed container width (a resize, not an arrangement) and newly
 * arrived elements are left alone. `enabled` is false under reduced motion.
 */
export function useFlip(root: RefObject<HTMLElement | null>, arrangement: string, enabled: boolean): void {
  const last = useRef<{ arrangement: string; width: number; points: Map<string, Point> } | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!enabled || !el) {
      last.current = null;
      return;
    }
    const base = layoutOffset(el);
    const points = new Map<string, Point>();
    for (const node of el.querySelectorAll<HTMLElement>('[data-flip]')) {
      if (node.offsetParent === null || node.dataset.flip === undefined) continue;
      const p = layoutOffset(node);
      points.set(node.dataset.flip, { x: p.x - base.x, y: p.y - base.y });
    }

    const prev = last.current;
    last.current = { arrangement, width: el.offsetWidth, points };
    if (!prev || prev.arrangement === arrangement || prev.width !== el.offsetWidth) return;

    for (const node of el.querySelectorAll<HTMLElement>('[data-flip]')) {
      const key = node.dataset.flip;
      const from = key === undefined ? undefined : prev.points.get(key);
      const to = key === undefined ? undefined : points.get(key);
      if (!from || !to) continue;
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      // The card, not its wrapper: the wrapper may still be running its entrance.
      const target = (node.firstElementChild as HTMLElement | null) ?? node;
      target.animate(
        [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'none' }],
        { duration: FLIP_MS, easing: FLIP_EASE },
      );
    }
  });
}
