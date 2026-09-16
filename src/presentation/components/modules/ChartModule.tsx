import { useId, type CSSProperties, type ReactElement } from 'react';
import type { SceneItem } from '../../../domain/Scene';
import { staggerIndex } from '../../hooks/useCountUp';
import { moduleItems } from './items';
import { ListModule } from './kinds';
import type { ModuleRendererProps } from './registry';
import styles from './ChartModule.module.css';

/*
 * Single-series chart. `weight` (0-100, relative) sets geometry; `value` is the
 * real number and is shown as text only, never parsed. Short ordinal labels with
 * five or more points read as a line; everything else as horizontal bars, which
 * reflow on narrow screens.
 */

type Point = SceneItem & { weight: number };

const LINE_H = 40;
/** Horizontal inset, in plot percent, so the 10 px end marker stays inside the plot box. */
const X_PAD = 1.4;

function asPoints(items: SceneItem[]): Point[] {
  return items.filter((it): it is Point => typeof it.weight === 'number');
}

function Bars({ points }: { points: Point[] }) {
  return (
    <ul className={styles.bars}>
      {points.map((p, i) => {
        const w = Math.max(1.5, Math.min(100, p.weight));
        return (
          <li key={i} className={styles.barRow} style={staggerIndex(i)}>
            <span className={styles.barLabel}>{p.label}</span>
            <span className={styles.barValue}>{p.value ?? ''}</span>
            <svg className={styles.barSvg} height="10" role="img" aria-label={p.value ? `${p.label}: ${p.value}` : p.label}>
              <rect className={styles.barTrack} x="0" y="4.5" width="100%" height="1" />
              <rect className={styles.barMark} x="0" y="0" width={`${w.toFixed(2)}%`} height="10" rx="3" />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}

function Line({ points }: { points: Point[] }) {
  const n = points.length;
  // Interpolated into a url(#...) reference, so it is reduced to characters that
  // are always valid in a fragment identifier whatever React's id format is.
  const clipId = `chart-wipe-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const coords = points.map((p, i) => ({
    x: n === 1 ? 50 : X_PAD + (i / (n - 1)) * (100 - 2 * X_PAD),
    y: LINE_H - 3 - (Math.min(100, Math.max(0, p.weight)) / 100) * (LINE_H - 8),
  }));
  const line = coords.map(c => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const area = `${coords[0].x.toFixed(2)},${LINE_H} ${line} ${coords[n - 1].x.toFixed(2)},${LINE_H}`;
  const peak = points.reduce((best, p, i) => (p.weight > points[best].weight ? i : best), 0);
  const labelIdx = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    <figure className={styles.lineFigure}>
      <div className={styles.plot}>
        <div className={styles.plotInner}>
        <svg className={styles.lineSvg} viewBox={`0 0 100 ${LINE_H}`} preserveAspectRatio="none" aria-hidden="true">
          {/*
            The line is drawn by wiping this clip rect across the plot, not by
            animating stroke-dashoffset. `vector-effect: non-scaling-stroke`
            makes the browser measure the dash pattern in screen pixels, and
            `pathLength` does not normalise it back, so a dashed stroke stayed
            visibly broken into ~100px segments even once settled. The gauge in
            kinds.module.css carries no vector-effect, which is why the same dash
            technique is correct there and wrong here.
          */}
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect className={styles.wipe} x="0" y="0" width="100" height={LINE_H} />
            </clipPath>
          </defs>
          <line className={styles.grid} x1="0" x2="100" y1={LINE_H - 0.5} y2={LINE_H - 0.5} vectorEffect="non-scaling-stroke" />
          <line className={styles.grid} x1="0" x2="100" y1={LINE_H / 2} y2={LINE_H / 2} vectorEffect="non-scaling-stroke" />
          <polygon className={styles.area} points={area} />
          <polyline className={styles.stroke} points={line} vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId})`} />
        </svg>
        {coords.map((c, i) => (
          <span
            key={i}
            className={i === peak || i === n - 1 ? styles.markerStrong : styles.marker}
            style={{ left: `${c.x}%`, top: `${(c.y / LINE_H) * 100}%`, '--i': i } as CSSProperties}
          />
        ))}
        {points[peak].value ? (
          <span
            className={styles.callout}
            // Near an edge the label anchors to that edge instead of straddling it.
            data-edge={coords[peak].x > 70 ? 'end' : coords[peak].x < 30 ? 'start' : 'mid'}
            style={{ left: `${coords[peak].x}%`, top: `${(coords[peak].y / LINE_H) * 100}%` }}
          >
            {points[peak].value}
          </span>
        ) : null}
        </div>
      </div>
      <div className={styles.axis} aria-hidden="true">
        {labelIdx.map(i => (
          <span key={i} className={styles.tick} style={{ left: `${coords[i].x}%` }} data-edge={i === 0 ? 'start' : i === n - 1 ? 'end' : 'mid'}>
            {points[i].label}
          </span>
        ))}
      </div>
      <ul className="visually-hidden">
        {points.map((p, i) => <li key={i}>{p.value ? `${p.label}: ${p.value}` : p.label}</li>)}
      </ul>
    </figure>
  );
}

export function ChartModule({ module }: ModuleRendererProps): ReactElement {
  const points = asPoints(moduleItems(module));
  if (points.length === 0) return <ListModule module={module} />;
  const asLine = points.length >= 5 && points.every(p => p.label.length <= 12);
  return asLine ? <Line points={points} /> : <Bars points={points} />;
}
