import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { SceneMotif } from '../../domain/Scene';
import { useSceneTheme } from '../scene/SceneTheme';
import styles from './HexGrid.module.css';

interface HexGridProps {
  W: number;
  H: number;
}

const HEX = 30;
const LATTICE = 44;
const WAVE_LEN = 260;
const WAVE_ROW = 44;
const RING_STEP = 56;
const CROSSFADE_MS = 900;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Flat-top honeycomb as a repeating pattern: one tile holds a hex at each corner and one in the middle. */
function Honeycomb({ W, H }: HexGridProps) {
  const tw = HEX * 3;
  const th = Math.sqrt(3) * HEX;
  return (
    <>
      <defs>
        <pattern id="motif-hex" width={tw} height={th} patternUnits="userSpaceOnUse">
          {[
            [0, 0],
            [tw, 0],
            [0, th],
            [tw, th],
            [tw / 2, th / 2],
          ].map(([x, y]) => (
            <polygon key={`${x}-${y}`} points={hexPoints(x, y, HEX)} />
          ))}
        </pattern>
      </defs>
      <rect className={styles.hexPan} x={-tw * 2} y={-th * 2} width={W + tw * 4} height={H + th * 4} fill="url(#motif-hex)" />
    </>
  );
}

/** Isometric lattice: three line families at 0°, 60° and 120°. */
function Lattice({ W, H }: HexGridProps) {
  const d = LATTICE;
  const h = d * Math.sqrt(3);
  return (
    <>
      <defs>
        <pattern id="motif-lattice" width={d} height={h} patternUnits="userSpaceOnUse">
          <path
            d={`M0,0 H${d} M0,${h / 2} H${d} M0,${h} L${d},0 M0,${h / 2} L${d / 2},0 M${d / 2},${h} L${d},${h / 2} M0,0 L${d},${h} M0,${h / 2} L${d / 2},${h} M${d / 2},0 L${d},${h / 2}`}
          />
        </pattern>
      </defs>
      <rect className={styles.latticePan} x={-d * 2} y={-h * 2} width={W + d * 4} height={H + h * 4} fill="url(#motif-lattice)" />
    </>
  );
}

/** Sine contour lines; each row drifts its phase so the field reads as terrain, not stripes. */
function Waves({ W, H }: HexGridProps) {
  const paths = useMemo(() => {
    const rows = Math.ceil(H / WAVE_ROW) + 2;
    const width = W + WAVE_LEN * 2;
    const out: string[] = [];
    for (let r = -1; r < rows; r++) {
      const y0 = r * WAVE_ROW;
      const amp = 10 + (r % 3) * 4;
      const phase = r * 0.9;
      let d = '';
      for (let x = -WAVE_LEN; x <= width; x += 16) {
        const y = y0 + amp * Math.sin((2 * Math.PI * x) / WAVE_LEN + phase) + 4 * Math.sin((2 * Math.PI * x) / (WAVE_LEN * 0.37) + phase * 2);
        d += `${d ? 'L' : 'M'}${x},${y.toFixed(1)} `;
      }
      out.push(d);
    }
    return out;
  }, [W, H]);

  return (
    <g className={styles.wavePan}>
      {paths.map((d, i) => (
        <path key={i} d={d} className={i % 4 === 0 ? styles.secondary : undefined} />
      ))}
    </g>
  );
}

/** Concentric rings from the viewport center; every fourth ring is dashed and takes the secondary hue. */
function Rings({ W, H }: HexGridProps) {
  const cx = W / 2;
  const cy = H / 2;
  const count = Math.ceil(Math.hypot(W, H) / 2 / RING_STEP) + 1;
  return (
    <g className={styles.ringsBreathe} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={(i + 1) * RING_STEP}
          className={i % 4 === 3 ? styles.secondary : undefined}
          strokeDasharray={i % 4 === 3 ? '6 10' : undefined}
        />
      ))}
    </g>
  );
}

const MOTIF: Record<Exclude<SceneMotif, 'none'>, (p: HexGridProps) => ReactElement> = {
  hex: Honeycomb,
  lattice: Lattice,
  wave: Waves,
  rings: Rings,
};

function MotifLayer({ motif, W, H, leaving }: HexGridProps & { motif: SceneMotif; leaving: boolean }) {
  if (motif === 'none') return null;
  const Draw = MOTIF[motif];
  return (
    <svg
      className={`${styles.layer} ${leaving ? styles.leaving : styles.entering}`}
      data-motif={motif}
      width="100%"
      height="100%"
    >
      <Draw W={W} H={H} />
    </svg>
  );
}

/**
 * Background motif for the scene: honeycomb (default), isometric lattice,
 * wave contours, concentric rings, or nothing (grain only, from Nebula).
 * A motif change crossfades the old layer out while the new one fades in.
 */
export function HexGrid({ W, H }: HexGridProps) {
  const { presentation } = useSceneTheme();
  const motif = presentation.motif;
  const [leaving, setLeaving] = useState<SceneMotif | null>(null);
  const previous = useRef(motif);

  useEffect(() => {
    if (previous.current === motif) return;
    setLeaving(previous.current);
    previous.current = motif;
    const id = window.setTimeout(() => setLeaving(null), CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [motif]);

  return (
    <div className={styles.root} aria-hidden>
      {leaving && leaving !== motif && <MotifLayer key={`out-${leaving}`} motif={leaving} W={W} H={H} leaving />}
      <MotifLayer key={motif} motif={motif} W={W} H={H} leaving={false} />
    </div>
  );
}
