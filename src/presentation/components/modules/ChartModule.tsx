import { useId, type CSSProperties, type ReactElement } from 'react';
import type { SceneItem } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { staggerIndex } from '../../hooks/useCountUp';
import { axisTicks, chartChange, chartExtremes, chartReadsAsLine, moduleItems, showsPointMarkers } from './items';
import { ListModule } from './kinds';
import type { ModuleRendererProps } from './registry';
import styles from './ChartModule.module.css';

/*
 * Single-series chart. `weight` (0-100, relative) sets geometry; `value` is the
 * real number and is shown as text. The one place it is parsed is the line's
 * first-to-last change readout, which is left out when the values do not read
 * as numbers in one unit. Short ordinal labels with five or more points read as
 * a line; everything else as horizontal bars, which reflow on narrow screens. A
 * `variant` replaces that guess: the model's is taken as given, and the card
 * fallback only assigns a line or area where the guess would have drawn one.
 *
 * A line holds up to 60 points (a few years of monthly closes): its x labels are
 * thinned to five, and past 16 points only the lowest, highest and last points
 * keep a marker.
 */

type Point = SceneItem & { weight: number };
type Mark = 'min' | 'max' | 'last';

const LINE_H = 40;
/** Horizontal inset, in plot percent, so the 10 px end marker stays inside the plot box. */
const X_PAD = 1.4;

function asPoints(items: SceneItem[]): Point[] {
  return items.filter((it): it is Point => typeof it.weight === 'number');
}

/** Dot plot: each point is a mark on its own thin track, for values read one by one. */
function Dots({ points }: { points: Point[] }) {
  return (
    <ul className={styles.bars} data-variant="dots">
      {points.map((p, i) => {
        const w = Math.max(1.5, Math.min(98.5, p.weight));
        return (
          <li key={i} className={styles.barRow} style={staggerIndex(i)}>
            <span className={styles.barLabel}>{p.label}</span>
            <span className={styles.barValue}>{p.value ?? ''}</span>
            <svg className={styles.barSvg} height="12" role="img" aria-label={p.value ? `${p.label}: ${p.value}` : p.label}>
              <rect className={styles.barTrack} x="0" y="5.5" width="100%" height="1" />
              <rect className={styles.barMark} x="0" y="5" width={`${w.toFixed(2)}%`} height="2" />
              {/* Square like every marker in the system; nested so the offset is in px while x is in %. */}
              <svg x={`${w.toFixed(2)}%`} y="0" overflow="visible">
                <rect className={styles.dotMark} x="-5" y="1" width="10" height="10" />
              </svg>
            </svg>
          </li>
        );
      })}
    </ul>
  );
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
              <rect className={styles.barMark} x="0" y="0" width={`${w.toFixed(2)}%`} height="10" />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}

function Line({ points, filled = false }: { points: Point[]; filled?: boolean }) {
  const { t } = useI18n();
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
  const { min, max } = chartExtremes(points);
  const last = n - 1;
  const markOf = (i: number): Mark | undefined => (i === last ? 'last' : i === max ? 'max' : i === min ? 'min' : undefined);
  const dense = !showsPointMarkers(n);
  const marked = dense ? Array.from(new Set([min, max, last])).sort((a, b) => a - b) : coords.map((_, i) => i);
  const ticks = axisTicks(n);
  const change = n > 1 ? chartChange(points[0].value, points[last].value) : null;
  const readouts: Array<{ mark: Mark; index: number }> = [
    { mark: 'min', index: min },
    { mark: 'max', index: max },
    { mark: 'last', index: last },
  ];

  return (
    <figure className={styles.lineFigure} data-variant={filled ? 'area' : undefined} data-dense={dense ? 'true' : undefined}>
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
        {marked.map(i => (
          <span
            key={i}
            className={markOf(i) ? styles.markerStrong : styles.marker}
            data-mark={markOf(i)}
            style={{ left: `${coords[i].x}%`, top: `${(coords[i].y / LINE_H) * 100}%`, '--i': i } as CSSProperties}
          />
        ))}
        {points[max].value ? (
          <span
            className={styles.callout}
            // Near an edge the label anchors to that edge instead of straddling it.
            data-edge={coords[max].x > 70 ? 'end' : coords[max].x < 30 ? 'start' : 'mid'}
            style={{ left: `${coords[max].x}%`, top: `${(coords[max].y / LINE_H) * 100}%` }}
          >
            {points[max].value}
          </span>
        ) : null}
        </div>
      </div>
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((i, k) => (
          <span
            key={i}
            className={styles.tick}
            style={{ left: `${coords[i].x}%` }}
            data-edge={i === 0 ? 'start' : i === n - 1 ? 'end' : 'mid'}
            // Every other inner label gives way first when the card is narrow.
            data-minor={k > 0 && k < ticks.length - 1 && k % 2 === 1 ? 'true' : undefined}
          >
            {points[i].label}
          </span>
        ))}
      </div>
      {n > 1 ? (
        <dl className={styles.readout}>
          {readouts.map(({ mark, index }) => (points[index].value ? (
            <div key={mark} className={styles.readoutItem} data-mark={mark}>
              <dt>{t(`chart.${mark}`)}</dt>
              <dd>
                {points[index].value}
                <span className={styles.readoutAt}>{points[index].label}</span>
              </dd>
            </div>
          ) : null))}
          {change ? (
            <div className={styles.readoutItem} data-mark="change" data-direction={change.direction}>
              <dt>{t('chart.change')}</dt>
              <dd>
                {change.absolute}
                {change.percent ? <span className={styles.readoutAt}>{change.percent}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <ul className="visually-hidden">
        {points.map((p, i) => <li key={i}>{p.value ? `${p.label}: ${p.value}` : p.label}</li>)}
      </ul>
    </figure>
  );
}

export function ChartModule({ module }: ModuleRendererProps): ReactElement {
  const points = asPoints(moduleItems(module));
  if (points.length === 0) return <ListModule module={module} />;
  switch (module.variant) {
    case 'line':
      return <Line points={points} />;
    case 'area':
      return <Line points={points} filled />;
    case 'bars':
      return <Bars points={points} />;
    case 'dots':
      return <Dots points={points} />;
    default: {
      return chartReadsAsLine(points) ? <Line points={points} /> : <Bars points={points} />;
    }
  }
}
