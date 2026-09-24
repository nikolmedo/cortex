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
  /** True while the latest turn is in flight; the field brightens and quickens. */
  active: boolean;
  reduced: boolean;
}

interface Target {
  palette: RgbPalette;
  speed: number;
  motif: SceneMotif;
  energy: number;
}

interface Mote {
  x: number;
  y: number;
  life: number;
  bright: boolean;
}

const PARTICLES = { mobile: 26, tablet: 48, desktop: 72 } as const;

/**
 * How strongly the flow motes show over each motif. Flow is made of them; rings
 * keep a faint drift; a grid is already a field of points, so it gets none.
 */
const MOTE_ALPHA: Record<SceneMotif, number> = { flow: 1, rings: 0.3, grid: 0, none: 0.45 };

/** A glow's gradient, drawn at unit alpha around the origin and reused until its colour or size changes. */
interface GlowCache {
  key: string;
  gradient: CanvasGradient;
}

/**
 * The single background layer: palette-tinted light plus one motif
 * (flow, rings, grid or none), drifting at the mood's speed.
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
    let motes: Mote[] = [];
    const state = {
      palette: { ...target.current.palette },
      speed: target.current.speed,
      energy: target.current.energy,
      motif: target.current.motif,
      motifAlpha: 1,
      clock: 0,
    };

    const seed = () => {
      motes = Array.from({ length: PARTICLES[deviceTier()] }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        life: Math.random(),
        bright: Math.random() < 0.2,
      }));
    };

    const glows: Array<GlowCache | null> = [null, null, null];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = fitCanvas(canvas, w, h, dprCap);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glows.fill(null);
      seed();
    };

    // Position and strength change every frame, so they are a translate and a
    // globalAlpha; only a new colour (the palette easing in) or radius rebuilds it.
    const glow = (slot: number, x: number, y: number, r: number, c: Rgb, a: number) => {
      const key = `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.round(r)}`;
      let cached = glows[slot];
      if (!cached || cached.key !== key) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, rgba(c, 1));
        g.addColorStop(0.45, rgba(c, 0.4));
        g.addColorStop(1, rgba(c, 0));
        cached = { key, gradient: g };
        glows[slot] = cached;
      }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.fillStyle = cached.gradient;
      ctx.fillRect(Math.max(-r, -x), Math.max(-r, -y), r * 2, r * 2);
      ctx.restore();
    };

    const drawFlow = (t: number, dt: number, alpha: number, move: boolean) => {
      const c = state.palette.primary;
      const v = 0.018 * state.speed * (0.7 + state.energy * 0.6);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const bright of [false, true]) {
        ctx.beginPath();
        for (const m of motes) {
          if (m.bright !== bright) continue;
          const angle = Math.sin(m.x * 0.0016 + t * 0.00005) * Math.cos(m.y * 0.0019 - t * 0.00004) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          if (move) {
            m.x += dx * v * dt;
            m.y += dy * v * dt;
            m.life += dt * 0.00008;
            if (m.x < -20 || m.x > w + 20 || m.y < -20 || m.y > h + 20 || m.life > 1) {
              m.x = Math.random() * w;
              m.y = Math.random() * h;
              m.life = 0;
            }
          }
          const len = bright ? 14 : 8;
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - dx * len, m.y - dy * len);
        }
        ctx.strokeStyle = rgba(c, (bright ? 0.42 : 0.2) * alpha);
        ctx.stroke();
      }
    };

    const drawRings = (t: number, alpha: number) => {
      const cx = w * 0.86;
      const cy = h * 0.16;
      const base = Math.max(w, h);
      const radii = [0.22, 0.36, 0.52, 0.72];
      ctx.lineWidth = 1;
      radii.forEach((f, i) => {
        const r = base * f;
        const rot = t * 0.00002 * state.speed * (i % 2 === 0 ? 1 : -1) * (1 + i * 0.3);
        ctx.strokeStyle = rgba(i % 2 === 0 ? state.palette.primary : state.palette.secondary, 0.075 * alpha);
        ctx.beginPath();
        ctx.arc(cx, cy, r, rot, rot + Math.PI * 0.62);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r, rot + Math.PI * 0.9, rot + Math.PI * 1.15);
        ctx.stroke();
      });
      const r = base * 0.36;
      const start = t * 0.00003 * state.speed;
      ctx.strokeStyle = rgba(state.palette.primary, 0.12 * alpha);
      ctx.beginPath();
      for (let k = 0; k < 24; k += 1) {
        const a = start + k * (Math.PI / 90);
        ctx.moveTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6));
        ctx.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12));
      }
      ctx.stroke();
    };

    // One path per brightness level: four fills a frame instead of one per dot.
    const gridAlphas = [0.05, 0.08, 0.14, 0.24];
    const drawGrid = (t: number, alpha: number) => {
      const gap = w < 768 ? 40 : 48;
      const oy = (t * 0.004 * state.speed) % gap;
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (let y = -gap + oy; y < h + gap; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const wave = Math.sin(x * 0.004 + y * 0.003 - t * 0.0006 * state.speed);
          const level = wave > 0.9 ? 3 : wave > 0.6 ? 2 : wave > 0 ? 1 : 0;
          paths[level].rect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }
      paths.forEach((path, level) => {
        ctx.fillStyle = rgba(state.palette.primary, gridAlphas[level] * alpha);
        ctx.fill(path);
      });
    };

    const render = (dt: number, move: boolean) => {
      const tgt = target.current;
      const k = move ? smoothing(dt, 640) : 1;
      approachPalette(state.palette, tgt.palette, k);
      state.speed += (tgt.speed - state.speed) * k;
      state.energy += (tgt.energy - state.energy) * (move ? smoothing(dt, 900) : 1);
      if (tgt.motif !== state.motif) {
        state.motifAlpha -= move ? dt / 360 : 1;
        if (state.motifAlpha <= 0) {
          state.motif = tgt.motif;
          state.motifAlpha = 0;
        }
      } else if (state.motifAlpha < 1) {
        state.motifAlpha = move ? Math.min(1, state.motifAlpha + dt / 640) : 1;
      }
      if (move) state.clock += dt * (0.6 + state.energy * 0.6);
      const t = move ? state.clock : 12000;

      ctx.clearRect(0, 0, w, h);
      const e = state.energy;
      const big = Math.max(w, h);
      glow(0, w * 0.18 + Math.sin(t * 0.00007) * w * 0.05, h * 0.1 + Math.cos(t * 0.00005) * h * 0.04, big * 0.55, state.palette.primary, 0.1 + e * 0.05);
      glow(1, w * 0.88 + Math.cos(t * 0.00006) * w * 0.04, h * 0.92, big * 0.5, state.palette.secondary, 0.065 + e * 0.03);
      glow(2, w * 0.55, h * 0.4 + Math.sin(t * 0.00004) * h * 0.06, big * 0.32, state.palette.accent, 0.025 + e * 0.035);

      const a = state.motifAlpha;
      if (state.motif === 'rings') drawRings(t, a);
      else if (state.motif === 'grid') drawGrid(t, a);
      const moteAlpha = MOTE_ALPHA[state.motif];
      if (moteAlpha > 0 && motes.length > 0) drawFlow(t, dt, a * moteAlpha, move);
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
