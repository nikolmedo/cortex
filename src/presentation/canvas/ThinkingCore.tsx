import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import type { ScenePalette } from '../../domain/Scene';
import { approachPalette, mixRgb, paletteToRgb, rgba, smoothing, type Rgb, type RgbPalette } from './color';
import { deviceTier, fitCanvas, subscribeTick } from './ticker';

/**
 * A square reticle: four corner brackets that turn in 45-degree steps while the
 * answer is being built, three nested square outlines (one per plan step) and a
 * small central square. Nothing glows.
 *
 * idle: still, the central square blinks slowly.
 * thinking: request sent, nothing back yet; the brackets step-rotate.
 * planned: preface arrived; palette handoff, one outline per plan step.
 * streaming: partial scenes are arriving; the reticle has contracted into the
 * header glyph but keeps stepping while the answer grows.
 * resolved: the scene arrived; the brackets square up, the centre flashes once,
 * then the loop stops drawing.
 * error: the reticle cools to grey and stills, still legible at glyph size.
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

const GREY: Rgb = [139, 152, 171];
const WHITE: Rgb = [255, 255, 255];
/** The paper tone of an inverted tag, used for the brackets so only the live parts take the signal colour. */
const PAPER: Rgb = [238, 242, 243];
/** Half-sizes of the nested outlines as a share of the canvas side, one per plan step. */
const OUTLINE_HALF = [0.1, 0.17, 0.24];
const SETTLE_MS = 1100;
/** How long the brackets hold between turns, in clock milliseconds. */
const STEP_MS = 900;
const QUARTER = Math.PI / 2;
const EIGHTH = Math.PI / 4;

const ENERGY: Record<CorePhase, number> = { idle: 0.4, thinking: 0.75, planned: 1, streaming: 0.9, resolved: 0.2, error: 0.3 };

/** Phases where the reticle sits at glyph size in the header. */
function isContracted(phase: CorePhase): boolean {
  return phase === 'streaming' || phase === 'resolved' || phase === 'error';
}

/** Phases where the brackets keep turning. */
function isStepping(phase: CorePhase): boolean {
  return phase === 'thinking' || phase === 'planned' || phase === 'streaming';
}

function outlineTarget(phase: CorePhase, step: StepState | undefined): number {
  if (phase === 'resolved') return 0.5;
  if (phase === 'error') return 0.6;
  if (phase === 'idle') return 0.34;
  if (!step) return phase === 'streaming' ? 0.7 : 0.42;
  return step === 'active' ? 0.95 : step === 'done' ? 0.6 : 0.2;
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
    outlines: number[];
    /** Bracket rotation now, where it is heading, and the time since its last step. */
    angle: number;
    turn: number;
    hold: number;
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

    if (!sim.current) {
      sim.current = {
        palette: { ...props.current.palette },
        energy: ENERGY[props.current.phase],
        contraction: 0,
        cool: 0,
        flare: 0,
        clock: Math.random() * 10000,
        outlines: OUTLINE_HALF.map(() => 0.3),
        angle: 0,
        turn: 0,
        hold: 0,
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
      OUTLINE_HALF.forEach((_, i) => {
        s.outlines[i] += (outlineTarget(ph, st.length > 0 ? st[i] ?? 'pending' : undefined) - s.outlines[i]) * (animate ? smoothing(dt, 360) : 1);
      });
      if (animate) {
        s.clock += dt * (0.2 + s.energy);
        if (isStepping(ph)) {
          // One 45-degree step, then a hold; the angle snaps over ~140ms rather than gliding.
          s.hold += dt * (0.5 + s.energy);
          if (s.hold >= STEP_MS) {
            s.hold = 0;
            s.turn += EIGHTH;
          }
        } else {
          // Settle on the nearest square orientation.
          s.turn = Math.round(s.turn / QUARTER) * QUARTER;
        }
        s.angle += (s.turn - s.angle) * smoothing(dt, 140);
      } else {
        s.turn = 0;
        s.angle = 0;
      }

      const P = mixRgb(s.palette.primary, GREY, s.cool);
      const ink = mixRgb(PAPER, GREY, s.cool);
      const t = s.clock;

      ctx.clearRect(0, 0, S, S);

      // Strokes thicken as the reticle contracts so the settled emblem still
      // reads once it is scaled down into the header.
      const weight = 1 + s.contraction * 3.2;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';

      // Nested outlines: one per plan step. Pending is a hairline, active runs a
      // dashed trace in the signal colour, done is solid.
      OUTLINE_HALF.forEach((f, i) => {
        const half = S * f;
        const step = st[i];
        const alpha = s.outlines[i];
        const active = step === 'active' && ph !== 'resolved' && ph !== 'error';
        const done = step === 'done' || ph === 'resolved';
        ctx.strokeStyle = rgba(active || done ? P : ink, active ? alpha : done ? alpha * 0.8 : 0.12 + alpha * 0.2);
        ctx.lineWidth = Math.max(1, S / 150) * weight * (active ? 1.4 : 1);
        ctx.setLineDash(active ? [S / 40, S / 40] : []);
        ctx.lineDashOffset = -t * 0.03;
        ctx.strokeRect(c - half, c - half, half * 2, half * 2);
      });
      ctx.setLineDash([]);

      // Corner brackets: the outer frame. They turn as a unit about the centre.
      const R = S * 0.34 * (1 - 0.08 * s.contraction);
      const L = S * 0.15;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(s.angle);
      ctx.strokeStyle = rgba(ink, 0.9);
      ctx.lineWidth = Math.max(1.5, S / 100) * weight;
      ctx.beginPath();
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          ctx.moveTo(sx * R, sy * (R - L));
          ctx.lineTo(sx * R, sy * R);
          ctx.lineTo(sx * (R - L), sy * R);
        }
      }
      ctx.stroke();
      ctx.restore();

      // Centre square: blinks hard while working, one bright flash when resolved.
      const working = ph === 'thinking' || ph === 'planned' || ph === 'streaming' || ph === 'idle';
      const lit = !working || Math.floor(t / 450) % 2 === 0;
      const half = S * 0.04 * (1 - 0.15 * s.contraction) * (1 + s.flare * 0.9);
      ctx.fillStyle = rgba(mixRgb(P, WHITE, 0.55 + s.flare * 0.4), lit ? 1 : 0.3);
      ctx.fillRect(c - half, c - half, half * 2, half * 2);
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
