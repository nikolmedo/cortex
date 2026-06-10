import type { BBox } from './types';

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

export interface ViewRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Transform that fits a stage-space bounding box inside a viewport rect.
 * Guarantees the whole graph is visible regardless of node count.
 */
export function fitTransform(
  bbox: BBox,
  rect: ViewRect,
  padding = 48,
  minK = 0.25,
  maxK = 1,
): ViewTransform {
  const bw = Math.max(bbox.maxX - bbox.minX, 1);
  const bh = Math.max(bbox.maxY - bbox.minY, 1);
  const k = Math.min(
    Math.max(Math.min((rect.width - padding * 2) / bw, (rect.height - padding * 2) / bh), minK),
    maxK,
  );
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return {
    x: rect.left + rect.width / 2 - k * cx,
    y: rect.top + rect.height / 2 - k * cy,
    k,
  };
}
