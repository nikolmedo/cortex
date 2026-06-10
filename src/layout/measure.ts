/*
 * Deterministic text measurement for layout. The font strings here must match
 * the CSS the nodes render with (see FactCard.module.css / CenterNode.module.css),
 * otherwise measured heights drift from rendered heights and overlap can return.
 */

export const FACT_CARD_W = 230;
const FACT_PAD_X = 26; // 12px left rule side + 14px right padding
const FACT_FONT = '12.5px "Space Mono"';
const FACT_LINE_H = 19.4 + 2; // line-height + safety margin
const FACT_CHROME_H = 36; // index header + vertical paddings

export const CENTER_W = 220;
export const CENTER_H = 250;
export const CATEGORY_W = 132;
export const CATEGORY_H = 152;

let ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (!ctx) {
    const canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')!;
  }
  return ctx;
}

/** Greedy word wrap returning the number of rendered lines. */
function wrapLines(text: string, font: string, maxWidth: number): number {
  const c = getCtx();
  c.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return 1;

  let lines = 1;
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (c.measureText(probe).width <= maxWidth || !line) {
      line = probe;
    } else {
      lines += 1;
      line = word;
    }
  }
  return lines;
}

export function measureFactHeight(text: string): number {
  const lines = wrapLines(text, FACT_FONT, FACT_CARD_W - FACT_PAD_X);
  return Math.ceil(lines * FACT_LINE_H + FACT_CHROME_H);
}

/** Resolves once the web fonts are available so measurements are accurate. */
export function fontsReady(): Promise<void> {
  return document.fonts.ready.then(() => undefined);
}
