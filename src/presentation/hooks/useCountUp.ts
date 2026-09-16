import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { subscribeTick } from '../canvas/ticker';
import { useMotion } from '../scene/MotionContext';
import { useReducedMotion } from './useReducedMotion';

/*
 * Counts a model-authored figure up to its final value while a turn reveals.
 *
 * The model's string stays the source of truth. We only animate when it parses
 * as a single numeric run, and the settled render is always the prop verbatim,
 * so a figure that streams in late ("1" -> "1,234") is never frozen on a stale
 * frame and we never reformat the number the model chose.
 */

/** Not read from --dur-slow: the tick is JS, and a CSS token would need a layout read every frame. */
const DURATION = 900;

/**
 * Optional prefix, ONE numeric core, optional suffix. Prefix and suffix reject
 * digits, so anything holding a second numeric run ("1.000.000", "3 of 5",
 * "10-20") fails to match and renders statically instead of being rewritten.
 */
const FIGURE = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/;

interface Figure {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
}

function parse(value: string): Figure | null {
  const match = FIGURE.exec(value);
  if (!match) return null;
  const [, prefix, core, suffix] = match;
  const plain = core.replace(/,/g, '');
  const target = Number(plain);
  if (!Number.isFinite(target)) return null;
  const dot = plain.indexOf('.');
  return {
    prefix,
    suffix,
    target,
    decimals: dot === -1 ? 0 : plain.length - dot - 1,
    grouped: core.includes(','),
  };
}

/** Thousands separators are re-inserted only when the model used them, and only as its own comma. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function render(figure: Figure, n: number): string {
  const [whole, fraction] = Math.min(n, figure.target).toFixed(figure.decimals).split('.');
  const head = figure.grouped ? group(whole) : whole;
  return `${figure.prefix}${head}${fraction ? `.${fraction}` : ''}${figure.suffix}`;
}

/**
 * Returns the text to render for `value`: an intermediate frame while counting,
 * otherwise `value` itself. Off when motion is reduced or the turn is settled.
 */
export function useCountUp(value: string): string {
  const { reveal } = useMotion();
  const reduced = useReducedMotion();

  const figure = parse(value);
  // The reduced-motion switch in global.css only reaches CSS animations, so this one opts out itself.
  const animate = figure !== null && reveal && !reduced;

  const [frame, setFrame] = useState<string | null>(() => (animate && figure ? render(figure, 0) : null));
  const shape = useRef(figure);
  const started = useRef(false);
  const stop = useRef<(() => void) | null>(null);

  // The figure can still be streaming, so the count reads its target per frame rather than closing over it.
  useEffect(() => {
    shape.current = figure;
  });

  // `figure` is deliberately not a dependency: a new object every render would tear
  // the subscription down mid-count. Only the on/off decision may restart this.
  useEffect(() => {
    if (!animate || started.current) return;
    started.current = true;

    let begin = 0;
    const settle = () => {
      stop.current?.();
      stop.current = null;
      setFrame(null); // hand the model's own string back, verbatim
    };

    stop.current = subscribeTick(now => {
      // The clock starts on the first tick, not at effect time, so a frame spent
      // waiting for the shared loop is not counted against the duration.
      if (begin === 0) begin = now;
      const current = shape.current;
      if (current === null) return settle();
      const t = Math.min(1, (now - begin) / DURATION);
      if (t >= 1) return settle();
      setFrame(render(current, current.target * (1 - (1 - t) ** 4)));
    });

    return () => {
      if (!stop.current) return;
      stop.current();
      stop.current = null;
      // Interrupted rather than finished (unmount, or the reveal ended), so a
      // later mount is allowed to count again.
      started.current = false;
    };
  }, [animate]);

  // Gated on `animate`, not just on `frame`: when a reveal is cut short (the turn
  // settles, or motion is switched to reduced mid-count) the last intermediate
  // frame must not stick. Anything other than an in-flight count renders the
  // model's own string.
  return animate && frame !== null ? frame : value;
}

/** Row index for the reveal stagger; every animated descendant reads it as `--i`. */
export function staggerIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
