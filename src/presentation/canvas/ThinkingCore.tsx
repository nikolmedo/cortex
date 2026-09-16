import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import type { ScenePalette } from '../../domain/Scene';
import { approachPalette, mixRgb, paletteToRgb, rgba, smoothing, type Rgb, type RgbPalette } from './color';
import { deviceTier, fitCanvas, subscribeTick } from './ticker';

/**
 * idle: landing emblem, slow breathing.
 * thinking: request sent, nothing back yet; rings search in the default palette.
 * planned: preface arrived; palette handoff, one ring per plan step.
 * streaming: partial scenes are arriving; the core has contracted into the
 * header glyph but keeps running while the answer grows.
 * resolved: the scene arrived; the core contracts and settles, then stops drawing.
 * error: the core cools to grey and stills, still legible at glyph size.
 */
export type CorePhase = 'idle' | 'thinking' | 'planned' | 'streaming' | 'resolved' | 'error';
export type StepState = 'pending' | 'active' | 'done';

interface ThinkingCoreProps {
  phase: CorePhase;
  palette: ScenePalette;
  /** One entry per plan step (0-3). Empty while no plan is known. */
  steps: StepState[];
  /** CSS pixel size of the square canvas. */
  size: number;
  reduced: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  big: boolean;
}

const GREY: Rgb = [139, 152, 171];
const WHITE: Rgb = [255, 255, 255];
const RING_RADII = [0.25, 0.345, 0.44];
const SETTLE_MS = 1100;

const ENERGY: Record<CorePhase, number> = { idle: 0.4, thinking: 0.75, planned: 1, streaming: 0.9, resolved: 0.2, error: 0.3 };

/** Phases where the core sits at glyph size in the header. */
function isContracted(phase: CorePhase): boolean {
  return phase === 'streaming' || phase === 'resolved' || phase === 'error';
}

function ringTarget(phase: CorePhase, step: StepState | undefined): number {
  if (phase === 'resolved') return 0.5;
  if (phase === 'error') return 0.6;
  if (phase === 'idle') return 0.34;
  if (!step) return phase === 'streaming' ? 0.7 : 0.42;
  return step === 'active' ? 0.9 : step === 'done' ? 0.6 : 0.2;
}

export function ThinkingCore({ phase, palette, steps, size, reduced, className, style }: ThinkingCoreProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbPalette = useMemo(() => paletteToRgb(palette), [palette]);
  const props = useRef({ phase, palette: rgbPalette, steps });
  props.current = { phase, palette: rgbPalette, steps };
  const stepsKey = steps.join(',');

  // Persistent simulation state survives phase changes so every transition is continuous.
  const sim = useRef<{
    palette: RgbPalette;
    energy: number;
    contraction: number;
    cool: number;
    flare: number;
    clock: number;
    rings: number[];
    particles: Particle[];
    phaseAt: number;
    lastPhase: CorePhase;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const tier = deviceTier();
    const dpr = fitCanvas(canvas, size, size, tier === 'mobile' ? 1.5 : 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(tier === 'mobile' ? 48 : 90, size * 0.42));
    if (!sim.current || sim.current.particles.length !== count) {
      sim.current = {
        palette: sim.current?.palette ?? { ...props.current.palette },
        energy: sim.current?.energy ?? ENERGY[props.current.phase],
        contraction: sim.current?.contraction ?? 0,
        cool: sim.current?.cool ?? 0,
        flare: 0,
        clock: sim.current?.clock ?? Math.random() * 10000,
        rings: sim.current?.rings ?? RING_RADII.map(() => 0.3),
        particles: Array.from({ length: count }, () => ({
          angle: Math.random() * Math.PI * 2,
          radius: 0.14 + Math.random() * 0.36,
          speed: 0.6 + Math.random() * 0.8,
          big: Math.random() < 0.12,
        })),
        phaseAt: performance.now(),
        lastPhase: props.current.phase,
      };
    }
    const s = sim.current;
    const S = size;
    const c = S / 2;

    const draw = (now: number, dt: number, animate: boolean) => {
      const { phase: ph, palette: pal, steps: st } = props.current;
      if (ph !== s.lastPhase) {
        if (ph === 'resolved') s.flare = 1;
        s.lastPhase = ph;
        s.phaseAt = now;
      }
      const k = animate ? smoothing(dt, 640) : 1;
      approachPalette(s.palette, pal, k);
      s.energy += (ENERGY[ph] - s.energy) * k;
      s.contraction += ((isContracted(ph) ? 1 : 0) - s.contraction) * k;
      s.cool += ((ph === 'error' ? 1 : 0) - s.cool) * k;
      s.flare = animate ? Math.max(0, s.flare - dt / 640) : 0;
      RING_RADII.forEach((_, i) => {
        s.rings[i] += (ringTarget(ph, st.length > 0 ? st[i] ?? 'pending' : undefined) - s.rings[i]) * (animate ? smoothing(dt, 360) : 1);
      });
      if (animate) s.clock += dt * (0.2 + s.energy);

      const P = mixRgb(s.palette.primary, GREY, s.cool);
      const Sec = mixRgb(s.palette.secondary, GREY, s.cool);
      const A = mixRgb(s.palette.accent, GREY, s.cool);
      const t = s.clock;
      const shrink = 1 - 0.32 * s.contraction;

      ctx.clearRect(0, 0, S, S);

      // Halo
      const haloA = 0.1 + s.energy * 0.12 + s.flare * 0.2;
      const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
      halo.addColorStop(0, rgba(P, haloA));
      halo.addColorStop(0.5, rgba(P, haloA * 0.35));
      halo.addColorStop(1, rgba(P, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, S, S);

      // Rings: each one is a live readout of a plan step. Strokes thicken as the core
      // contracts so the settled emblem still reads once it is scaled into the header.
      const weight = 1 + s.contraction * 3.2;
      ctx.lineCap = 'round';
      RING_RADII.forEach((f, i) => {
        const r = S * f * shrink;
        const alpha = s.rings[i];
        const step = st[i];
        const color = step === 'done' || ph === 'resolved' ? mixRgb(P, A, 0.35) : i === 1 ? mixRgb(P, Sec, 0.4) : P;
        ctx.lineWidth = Math.max(1, S / 160) * weight;

        ctx.strokeStyle = rgba(color, 0.07 + alpha * 0.12);
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.stroke();

        const dir = i % 2 === 0 ? 1 : -1;
        const rot = t * 0.0007 * dir * (1 + i * 0.35) + i * 2.1;
        const closed = ph === 'resolved' || ph === 'error' || step === 'done';
        const sweep = closed
          ? Math.PI * (1.2 + 0.8 * s.contraction)
          : Math.PI * (0.32 + 0.22 * Math.sin(t * 0.0012 + i * 1.7)) * (step === 'active' ? 1.6 : 1);
        ctx.strokeStyle = rgba(color, alpha);
        ctx.lineWidth = Math.max(1.2, S / (step === 'active' ? 90 : 130)) * weight;
        ctx.beginPath();
        ctx.arc(c, c, r, rot, rot + sweep);
        ctx.stroke();
        if (!closed) {
          ctx.strokeStyle = rgba(color, alpha * 0.5);
          ctx.beginPath();
          ctx.arc(c, c, r, rot + Math.PI, rot + Math.PI + sweep * 0.35);
          ctx.stroke();
        }

        if (step === 'active' && ph === 'planned') {
          const hx = c + Math.cos(rot + sweep) * r;
          const hy = c + Math.sin(rot + sweep) * r;
          const head = ctx.createRadialGradient(hx, hy, 0, hx, hy, S * 0.045);
          head.addColorStop(0, rgba(mixRgb(color, WHITE, 0.6), 0.95));
          head.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = head;
          ctx.fillRect(hx - S * 0.045, hy - S * 0.045, S * 0.09, S * 0.09);
        }
      });

      // Readout ticks on the outer ring
      const outer = S * 0.49 * shrink;
      ctx.strokeStyle = rgba(P, 0.1 + s.energy * 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const tickStart = -t * 0.00025;
      for (let n = 0; n < 48; n += 1) {
        const a = tickStart + (n / 48) * Math.PI * 2;
        const len = n % 4 === 0 ? S * 0.022 : S * 0.011;
        ctx.moveTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer);
        ctx.lineTo(c + Math.cos(a) * (outer - len), c + Math.sin(a) * (outer - len));
      }
      ctx.stroke();

      // Particle flow spiralling inward
      const visible = (1 - 0.9 * s.contraction) * (1 - 0.7 * s.cool);
      if (visible > 0.02) {
        ctx.fillStyle = rgba(mixRgb(P, WHITE, 0.25), 1);
        for (const p of s.particles) {
          if (animate) {
            const inward = (0.000028 + 0.00006 * s.energy) * (1 + s.contraction * 4) * p.speed;
            p.radius -= inward * dt;
            p.angle += (0.0006 + 0.0012 / Math.max(0.12, p.radius * 3)) * dt * (0.3 + s.energy) * p.speed;
            if (p.radius < 0.09) {
              p.radius = 0.42 + Math.random() * 0.08;
              p.angle = Math.random() * Math.PI * 2;
            }
          }
          const fadeIn = Math.min(1, (0.5 - p.radius) / 0.08);
          const fadeOut = Math.min(1, (p.radius - 0.09) / 0.06);
          ctx.globalAlpha = Math.max(0, fadeIn * fadeOut) * 0.75 * visible;
          const pr = S * p.radius * shrink;
          const dot = p.big ? 1.7 : 1.05;
          ctx.fillRect(c + Math.cos(p.angle) * pr - dot / 2, c + Math.sin(p.angle) * pr - dot / 2, dot, dot);
        }
        ctx.globalAlpha = 1;
      }

      // Nucleus
      const pulse = 1 + 0.07 * Math.sin(t * 0.003);
      const nr = S * 0.11 * pulse * (1 - 0.2 * s.contraction) * (1 + s.flare * 0.5);
      const glowA = 0.55 + s.energy * 0.4 + s.flare * 0.3;
      const nucleus = ctx.createRadialGradient(c, c, 0, c, c, nr);
      nucleus.addColorStop(0, rgba(mixRgb(P, WHITE, 0.75), Math.min(1, glowA)));
      nucleus.addColorStop(0.35, rgba(P, glowA * 0.6));
      nucleus.addColorStop(1, rgba(P, 0));
      ctx.fillStyle = nucleus;
      ctx.fillRect(c - nr, c - nr, nr * 2, nr * 2);
    };

    if (reduced) {
      draw(performance.now(), 16, false);
      return undefined;
    }

    // 'streaming' keeps the loop alive: content is still arriving.
    const terminal = phase === 'resolved' || phase === 'error';
    let unsubscribe: (() => void) | null = null;
    unsubscribe = subscribeTick((now, dt) => {
      draw(now, dt, true);
      if (terminal && now - s.phaseAt > SETTLE_MS) {
        unsubscribe?.();
        unsubscribe = null;
      }
    });
    return () => unsubscribe?.();
  }, [phase, size, reduced, rgbPalette, stepsKey]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    />
  );
}
