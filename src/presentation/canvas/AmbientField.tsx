import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import type { ScenePalette, SceneMood, SceneMotif } from '../../domain/Scene';
import { MOOD_SPEED } from '../scene/sceneTokens';
import { approachPalette, paletteToRgb, rgba, smoothing, type Rgb, type RgbPalette } from './color';
import { deviceTier, fitCanvas, subscribeTick } from './ticker';
import styles from './AmbientField.module.css';

interface AmbientFieldProps {
  palette: ScenePalette;
  mood: SceneMood;
  motif: SceneMotif;
  /** True while the latest turn is in flight; the graph brightens and quickens. */
  active: boolean;
  reduced: boolean;
}

interface Target {
  palette: RgbPalette;
  speed: number;
  motif: SceneMotif;
  energy: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** One node in eight carries the scene's signal colour instead of paper. */
  signal: boolean;
  /** A few paper nodes breathe too, softly; the rest hold still. */
  breathes: boolean;
  /** Where this node is in its breath, in radians, so they never pulse together. */
  phase: number;
}

const NODES = { mobile: 14, tablet: 22, desktop: 32 } as const;

/** Edges join nodes closer than this, as a share of the shorter screen side (floored in px). */
const LINK_SHARE = 0.34;
const LINK_MIN = 120;
const LINK_MAX = 260;

/** Neutral paper tone for nodes and edges. The only colour is the sparse signal node. */
const PAPER: Rgb = [216, 228, 234];

/** Edge alpha steps, nearest to farthest: three paths a frame instead of one stroke per edge. */
const EDGE_ALPHAS = [0.1, 0.065, 0.034] as const;

/** Breathing period of a node, in clock milliseconds. */
const BREATH_MS = 3600;
const TAU = Math.PI * 2;

/**
 * The single background layer: a sparse network graph. Round nodes drift at the
 * mood's speed and thin lines join the ones that come near each other; the
 * signal nodes (and a few paper ones) breathe, and a signal node sends out a
 * slow ring now and then. It stays low contrast and draws no glow; the motif
 * is not drawn.
 */
export function AmbientField({ palette, mood, motif, active, reduced }: AmbientFieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbPalette = useMemo(() => paletteToRgb(palette), [palette]);
  const target = useRef<Target>({ palette: rgbPalette, speed: MOOD_SPEED[mood], motif, energy: active ? 1 : 0 });
  target.current = { palette: rgbPalette, speed: MOOD_SPEED[mood], motif, energy: active ? 1 : 0 };
  const redraw = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const tier = deviceTier();
    const dprCap = tier === 'mobile' ? 1 : 1.5;
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    const state = {
      palette: { ...target.current.palette },
      speed: target.current.speed,
      energy: target.current.energy,
      /** Clock for the breathing; only advances while the field animates. */
      clock: 0,
    };

    const seed = () => {
      nodes = Array.from({ length: NODES[deviceTier()] }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const pace = 0.5 + Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * pace,
          vy: Math.sin(angle) * pace,
          signal: i % 8 === 0,
          breathes: i % 5 === 2,
          phase: Math.random() * TAU,
        };
      });
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = fitCanvas(canvas, w, h, dprCap);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const render = (dt: number, move: boolean) => {
      const tgt = target.current;
      const k = move ? smoothing(dt, 640) : 1;
      approachPalette(state.palette, tgt.palette, k);
      state.speed += (tgt.speed - state.speed) * k;
      state.energy += (tgt.energy - state.energy) * (move ? smoothing(dt, 900) : 1);

      // A drift of a few pixels a second; a turn in flight quickens it a little.
      const v = 0.012 * state.speed * (0.8 + state.energy * 0.5);
      if (move) {
        state.clock += dt;
        for (const n of nodes) {
          n.x += n.vx * v * dt;
          n.y += n.vy * v * dt;
          if (n.x < -20) n.x = w + 20;
          else if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20;
          else if (n.y > h + 20) n.y = -20;
        }
      }

      ctx.clearRect(0, 0, w, h);
      const boost = 1 + state.energy * 0.45;
      const reach = Math.min(LINK_MAX, Math.max(LINK_MIN, Math.min(w, h) * LINK_SHARE));
      const reachSq = reach * reach;

      const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > reachSq) continue;
          const band = d2 < reachSq * 0.25 ? 0 : d2 < reachSq * 0.6 ? 1 : 2;
          paths[band].moveTo(nodes[i].x, nodes[i].y);
          paths[band].lineTo(nodes[j].x, nodes[j].y);
        }
      }
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      paths.forEach((path, band) => {
        ctx.strokeStyle = rgba(PAPER, EDGE_ALPHAS[band] * boost);
        ctx.stroke(path);
      });

      // Nodes are small round dots. The still paper ones are batched into one
      // path; the breathing ones and the signal ones are drawn one by one.
      const still = new Path2D();
      for (const n of nodes) {
        if (n.signal || n.breathes) continue;
        still.moveTo(n.x + 1.5, n.y);
        still.arc(n.x, n.y, 1.5, 0, TAU);
      }
      ctx.fillStyle = rgba(PAPER, 0.28 * boost);
      ctx.fill(still);

      // Slow in, slow out: 0 at rest, 1 at the top of the breath.
      const breath = (n: Node) => 0.5 + 0.5 * Math.sin((state.clock / BREATH_MS) * TAU + n.phase);
      for (const n of nodes) {
        if (n.signal || !n.breathes) continue;
        const b = breath(n);
        ctx.fillStyle = rgba(PAPER, (0.2 + b * 0.22) * boost);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.4 + b * 0.9, 0, TAU);
        ctx.fill();
      }

      for (const n of nodes) {
        if (!n.signal) continue;
        const b = breath(n);
        ctx.fillStyle = rgba(state.palette.primary, (0.42 + b * 0.22) * boost);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.4 + b * 1.1, 0, TAU);
        ctx.fill();
        // A ring leaves the node once per breath and fades as it widens.
        const ring = (state.clock / (BREATH_MS * 1.6) + n.phase / TAU) % 1;
        ctx.strokeStyle = rgba(state.palette.primary, (1 - ring) * 0.26 * boost);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4 + ring * 12, 0, TAU);
        ctx.stroke();
      }
    };

    redraw.current = reduced ? () => render(16, false) : () => undefined;
    const onResize = () => {
      resize();
      redraw.current();
    };
    onResize();
    window.addEventListener('resize', onResize);

    // The shared ticker already stops while the tab is hidden; the field also
    // rests while the window is in the background, and picks up where it left
    // off (the ticker caps the first dt, so nothing jumps on the way back).
    let unsubscribe: (() => void) | null = null;
    const play = () => {
      if (reduced || unsubscribe || document.visibilityState !== 'visible') return;
      unsubscribe = subscribeTick((_now, dt) => render(dt, true));
    };
    const pause = () => {
      unsubscribe?.();
      unsubscribe = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' && document.hasFocus() ? play() : pause());
    play();
    window.addEventListener('focus', play);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      pause();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focus', play);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  useEffect(() => {
    redraw.current();
  }, [rgbPalette, mood, motif, active]);

  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />;
}
