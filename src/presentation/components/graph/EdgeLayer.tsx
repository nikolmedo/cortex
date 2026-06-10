import { useLayoutEffect, useRef } from 'react';
import { CYAN } from '../../../infrastructure/constants';
import type { LayoutResult } from '../../../layout/types';

interface EdgeLayerProps {
  layout: LayoutResult;
  focusedCat: number | null;
}

/** Quadratic Bézier with the midpoint pushed ~12% perpendicular — organic, not spokes. */
function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const bend = len * 0.12;
  const mx = (sx + tx) / 2 - (dy / len) * bend;
  const my = (sy + ty) / 2 + (dx / len) * bend;
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
}

function DrawnPath({
  id,
  d,
  stroke,
  width,
  delay,
}: {
  id: string;
  d: string;
  stroke: string;
  width: number;
  delay: number;
}) {
  const ref = useRef<SVGPathElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.style.animation = `edgeDraw 0.85s cubic-bezier(0.5, 0, 0.5, 1) ${delay}s both`;
  }, [d, delay]);

  return <path ref={ref} id={id} d={d} stroke={stroke} strokeWidth={width} fill="none" />;
}

export function EdgeLayer({ layout, focusedCat }: EdgeLayerProps) {
  const { byId, edges } = layout;

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <filter id="glow-edge" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {edges.map(edge => {
          const s = byId.get(edge.sourceId)!;
          const t = byId.get(edge.targetId)!;
          const from = edge.sourceId === 'center' ? CYAN : edge.color;
          return (
            <linearGradient
              key={`g-${edge.id}`}
              id={`g-${edge.id}`}
              gradientUnits="userSpaceOnUse"
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
            >
              <stop offset="0%" stopColor={from} stopOpacity={0.3} />
              <stop offset="100%" stopColor={edge.color} stopOpacity={0.55} />
            </linearGradient>
          );
        })}
      </defs>

      {edges.map(edge => {
        const s = byId.get(edge.sourceId)!;
        const t = byId.get(edge.targetId)!;
        const d = edgePath(s.x, s.y, t.x, t.y);
        const isTrunk = edge.factIndex === -1;
        const dimmed = focusedCat != null && edge.catIndex !== focusedCat;
        const delay = isTrunk
          ? 0.45 + edge.catIndex * 0.08
          : 0.9 + edge.catIndex * 0.04 + edge.factIndex * 0.05;
        const showPulse = isTrunk || focusedCat === edge.catIndex;

        return (
          <g
            key={edge.id}
            filter="url(#glow-edge)"
            style={{ opacity: dimmed ? 0.1 : 1, transition: 'opacity 0.4s ease' }}
          >
            <DrawnPath
              id={edge.id}
              d={d}
              stroke={`url(#g-${edge.id})`}
              width={isTrunk ? 1.2 : 0.9}
              delay={delay}
            />
            {showPulse && (
              <circle
                r={isTrunk ? 3 : 2}
                fill={edge.color}
                style={{ filter: `drop-shadow(0 0 4px ${edge.color})` }}
              >
                <animateMotion
                  dur={`${isTrunk ? 2.6 + edge.catIndex * 0.28 : 1.8 + (edge.catIndex + edge.factIndex) * 0.22}s`}
                  repeatCount="indefinite"
                  begin={`${(edge.catIndex * 0.42 + Math.max(edge.factIndex, 0) * 0.28).toFixed(2)}s`}
                >
                  <mpath href={`#${edge.id}`} />
                </animateMotion>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
