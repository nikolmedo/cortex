import type { NodeKind, NodeSize, NodeSizes, NodeSpec } from './types';

/*
 * Fixed width per node role. Heights come from measuring the real React
 * content offscreen (useMeasuredSizes); the fallbacks below only cover the
 * DOM-free path (layout-check) and a measurement that returned zero.
 */
export const ROLE_W: Record<NodeKind, number> = {
  center: 220,
  spotlight: 260,
  category: 132,
  fact: 230,
  block: 320,
};

export const CENTER_H = 250;

const FALLBACK_H: Record<NodeKind, number> = {
  center: CENTER_H,
  spotlight: 96,
  category: 152,
  fact: 80,
  block: 220,
};

export function sizeOf(sizes: NodeSizes, spec: NodeSpec): NodeSize {
  const measured = sizes.get(spec.id);
  if (measured && measured.w > 0 && measured.h > 0) return measured;
  return { w: ROLE_W[spec.kind], h: FALLBACK_H[spec.kind] };
}

/** Resolves once the web fonts are available so measurements are accurate. */
export function fontsReady(): Promise<void> {
  return document.fonts.ready.then(() => undefined);
}
