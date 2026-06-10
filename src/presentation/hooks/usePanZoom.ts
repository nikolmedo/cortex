import { useCallback, useEffect, useRef } from 'react';
import { fitTransform, type ViewRect, type ViewTransform } from '../../layout/fitView';
import type { BBox } from '../../layout/types';

const MIN_K = 0.25;
const MAX_K = 3;

export interface PanZoom {
  /** Attach to the gesture-capturing container (full-viewport div). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the transformed stage element (transform-origin must be 0 0). */
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Live transform — read-only outside (e.g. for particle parallax). */
  transformRef: React.RefObject<ViewTransform>;
  setTransform: (t: ViewTransform, animate?: boolean) => void;
  zoomToFit: (bbox: BBox, rect: ViewRect, animate?: boolean) => void;
}

/**
 * Custom pan/zoom over a single translate+scale stage:
 * pointer drag pan, wheel zoom toward cursor (ctrlKey = trackpad pinch),
 * two-pointer touch pinch. No d3-zoom — plain Pointer Events.
 */
export function usePanZoom(): PanZoom {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, k: 1 });
  const animTimer = useRef<number | null>(null);

  const apply = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { x, y, k } = transformRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  }, []);

  const setTransform = useCallback(
    (t: ViewTransform, animate = false) => {
      transformRef.current = t;
      const el = stageRef.current;
      if (el) {
        if (animTimer.current) window.clearTimeout(animTimer.current);
        el.style.transition = animate ? 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        if (animate) {
          animTimer.current = window.setTimeout(() => {
            if (stageRef.current) stageRef.current.style.transition = 'none';
          }, 700);
        }
      }
      apply();
    },
    [apply],
  );

  const zoomToFit = useCallback(
    (bbox: BBox, rect: ViewRect, animate = true) => {
      setTransform(fitTransform(bbox, rect), animate);
    },
    [setTransform],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;

    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const t = transformRef.current;
      const k = Math.min(Math.max(t.k * factor, MIN_K), MAX_K);
      const ratio = k / t.k;
      setTransform({
        k,
        x: clientX - ratio * (clientX - t.x),
        y: clientY - ratio * (clientY - t.y),
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      // No pointer capture: it would retarget clicks away from node buttons.
      // Elements marked data-no-pan (selectable fact text) opt out of panning.
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(b.x - a.x, b.y - a.y);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const curr = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, curr);

      if (pointers.size === 1) {
        const t = transformRef.current;
        setTransform({ ...t, x: t.x + curr.x - prev.x, y: t.y + curr.y - prev.y });
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (pinchDist > 0) {
          zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinchDist);
        }
        pinchDist = dist;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const intensity = e.ctrlKey ? 0.01 : 0.002;
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * intensity));
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('wheel', onWheel, { passive: false });
    // Window-level release so a drag ending outside the window never sticks.
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [setTransform]);

  return { containerRef, stageRef, transformRef, setTransform, zoomToFit };
}
