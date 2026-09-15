import { useLayoutEffect, useRef } from 'react';
import type { LayoutResult } from '../../../layout/types';
import { edgeDelay, type Choreography } from '../../scene/choreography';
import { useSceneTheme } from '../../scene/SceneTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface EdgeLayerProps {
  layout: LayoutResult;
  focusedCat: number | null;
  choreography: Choreography;
}

/** Quadratic Bézier with the midpoint pushed perpendicular by `bow` × length — organic, not spokes. */
function edgePath(sx: number, sy: number, tx: number, ty: number, bow: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const bend = len * bow;
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
  duration,
}: {
  id: string;
  d: string;
  stroke: string;
  width: number;
  delay: number;
  duration: number;
}) {
  const ref = useRef<SVGPathElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    el.style.animation = `edgeDraw ${duration}s cubic-bezier(0.5, 0, 0.5, 1) ${delay}s both`;
  }, [d, delay, duration]);

  return <path ref={ref} id={id} d={d} stroke={stroke} strokeWidth={width} fill="none" />;
}

export function EdgeLayer({ layout, focusedCat, choreography }: EdgeLayerProps) {
  const { byId, edges } = layout;
  const { delays, curvature, motionScale } = choreography;
  const { accent } = useSceneTheme();
  const reducedMotion = useReducedMotion();

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
          const from = edge.sourceId === 'center' ? accent : edge.color;
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
        const fromCenter = edge.role !== 'leaf';
        const d = edgePath(s.x, s.y, t.x, t.y, fromCenter ? curvature : curvature * 0.8);
        const dimmed = focusedCat != null && edge.catIndex !== focusedCat;
        const showPulse = !reducedMotion && (fromCenter || focusedCat === edge.catIndex);
        const seq = Math.max(edge.catIndex, 0);
        const pulseDur = (fromCenter ? 2.6 + seq * 0.28 : 1.8 + (seq + edge.factIndex) * 0.22) / motionScale;

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
              width={fromCenter ? 1.2 : 0.9}
              delay={edgeDelay(edge, delays)}
              duration={0.85 / motionScale}
            />
            {showPulse && (
              <circle
                r={fromCenter ? 3 : 2}
                fill={edge.color}
                style={{ filter: `drop-shadow(0 0 4px ${edge.color})` }}
              >
                <animateMotion
                  dur={`${pulseDur.toFixed(2)}s`}
                  repeatCount="indefinite"
                  begin={`${(seq * 0.42 + Math.max(edge.factIndex, 0) * 0.28).toFixed(2)}s`}
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
