import { CYAN, TOP_BAR_H, BOTTOM_STRIP_H } from '../infrastructure/constants';
import type { GraphData } from '../domain/GraphData';

export interface CategoryPos {
  x: number;
  y: number;
  θ: number;
  color: string;
}

export interface FactPos {
  x: number;
  y: number;
}

export interface Layout {
  cx: number;
  cy: number;
  categories: CategoryPos[];
  facts: FactPos[][];
}

export function computeLayout(
  graphData: GraphData,
  W: number,
  H: number,
  focusedCat: number | null,
): Layout {
  const availH = H - TOP_BAR_H - BOTTOM_STRIP_H;
  const cx = W / 2;
  const cy = TOP_BAR_H + availH / 2;
  const N = Math.max(graphData.graph.length, 1);

  const minDim = Math.min(W * 0.9, availH);
  const catR = Math.min((minDim / 2 - 55) / 1.55, 200);
  const catRx = catR * (W / H > 1.4 ? 1.18 : 1.0);
  const catRy = catR;

  const PAD_X = 110;
  const PAD_TOP = TOP_BAR_H + 60;
  const PAD_BOT = H - BOTTOM_STRIP_H - 50;

  const orbitPos = (i: number): CategoryPos => {
    const θ = (2 * Math.PI * i / N) - Math.PI / 2;
    return {
      x: cx + catRx * Math.cos(θ),
      y: cy + catRy * Math.sin(θ),
      θ,
      color: graphData.graph[i].color || CYAN,
    };
  };

  const isFocused = focusedCat != null && focusedCat >= 0 && focusedCat < N;

  const categories: CategoryPos[] = graphData.graph.map((cat, i) => {
    if (isFocused && i === focusedCat) {
      return { x: cx, y: cy, θ: -Math.PI / 2, color: cat.color || CYAN };
    }
    return orbitPos(i);
  });

  const FACT_START = 68;
  const FACT_STEP = 82;

  const facts: FactPos[][] = graphData.graph.map((cat, i) => {
    if (isFocused && i === focusedCat) {
      const M = cat.facts.length;
      const factR = Math.min(220, Math.max(170, minDim * 0.32));
      return cat.facts.map((_, j) => {
        const angle = (2 * Math.PI * j / Math.max(M, 1)) - Math.PI / 2;
        return {
          x: Math.max(PAD_X, Math.min(W - PAD_X, cx + factR * Math.cos(angle))),
          y: Math.max(PAD_TOP, Math.min(PAD_BOT, cy + factR * Math.sin(angle))),
        };
      });
    }
    const c = orbitPos(i);
    return cat.facts.map((_, j) => {
      const dist = FACT_START + j * FACT_STEP;
      return {
        x: Math.max(PAD_X, Math.min(W - PAD_X, c.x + dist * Math.cos(c.θ))),
        y: Math.max(PAD_TOP, Math.min(PAD_BOT, c.y + dist * Math.sin(c.θ))),
      };
    });
  });

  return { cx, cy, categories, facts };
}

export function floatOffset(k: number, t: number): { dx: number; dy: number } {
  const TAU = 2 * Math.PI;
  const fk = 0.0004 + (k % 7) * 0.00003;
  const gk = 0.0003 + (k % 11) * 0.000025;
  const φk = (k * 137.508 * Math.PI / 180) % TAU;
  const ψk = (k * 97.321 * Math.PI / 180) % TAU;
  return {
    dx: 6 * Math.sin(t * fk + φk),
    dy: 4 * Math.cos(t * gk + ψk),
  };
}
