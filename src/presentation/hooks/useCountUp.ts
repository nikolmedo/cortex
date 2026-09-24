import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { subscribeTick } from '../canvas/ticker';
import { useMotion } from '../scene/MotionContext';
import { useReducedMotion } from './useReducedMotion';

/*
 * Counts a model-authored figure up to its final value, for a card whose
 * `reveal` is `count`, while its turn reveals.
 *
 * The model's string stays the source of truth: React always renders the value
 * verbatim, and the count only overwrites the node's text between frames. We
 * only animate when the value parses as a single numeric run, and when the count
 * ends the node is handed back to React, so a figure that streams in late
 * ("1" -> "1,234") is never frozen on a stale frame and never reformatted.
 */

/** Length of the count. Not read from --dur-slow: the tick is JS, and a CSS token would need a style read. */
export const COUNT_MS = 800;

/** Share of the count during which the trailing digits still scramble. */
const DECODE_SHARE = 0.55;

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

/** Replaces the last `count` digits with random ones: the part of the figure still decoding. */
function scramble(text: string, count: number): string {
  if (count <= 0) return text;
  const chars = text.split('');
  let left = count;
  for (let i = chars.length - 1; i >= 0 && left > 0; i -= 1) {
    if (chars[i] >= '0' && chars[i] <= '9') {
      chars[i] = String(Math.floor(Math.random() * 10));
      left -= 1;
    }
  }
  return chars.join('');
}

function digitCount(text: string): number {
  return text.replace(/\D/g, '').length;
}

/**
 * The count's clock: progress from 0 to 1 (and past it once done). It starts on
 * the first tick plus the delay read at that moment, so neither a frame spent
 * waiting for the loop nor the card's stagger eats the count. A later delay is
 * ignored: the stagger slot shifts as later partials land, and a count that has
 * begun must not restart or stall because of it.
 */
export function countClock(): (now: number, delay: number) => number {
  let begin: number | null = null;
  return (now, delay) => {
    if (begin === null) begin = now + delay;
    return Math.max(0, now - begin) / COUNT_MS;
  };
}

/**
 * Drives the count on `ref`'s text node directly, so a frame costs no render.
 * Returns an epoch the caller keys the node on: it bumps when the count ends or
 * is cut short, which remounts the node with React's own, final text.
 */
export function useCountUp(value: string, ref: RefObject<HTMLElement | null>): number {
  const { reveal, entrance, delay } = useMotion();
  const reduced = useReducedMotion();
  const figure = parse(value);
  // The reduced-motion switch in global.css only reaches CSS animations, so this one opts out itself.
  const animate = figure !== null && entrance === 'count' && reveal && !reduced;

  const [epoch, setEpoch] = useState(0);
  const shape = useRef(figure);
  const wait = useRef(delay);
  const done = useRef(false);

  // The figure can still be streaming, so the count reads its target per frame
  // rather than closing over it. The delay is read the same way, but only once.
  useEffect(() => {
    shape.current = figure;
    wait.current = delay;
  });

  // The first frame is written before paint, so the final value never flashes first.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!animate || done.current || !node || !shape.current) return;
    node.textContent = scramble(render(shape.current, 0), 1);
  }, [animate, ref]);

  // `figure` and `delay` are deliberately not dependencies: a new object every
  // render, or a stagger slot that shifts as later partials land, would tear the
  // subscription down mid-count. Only the on/off decision may restart this.
  useEffect(() => {
    if (!animate || done.current) return undefined;
    const clock = countClock();
    let stop: (() => void) | null = null;
    const settle = () => {
      stop?.();
      stop = null;
      done.current = true;
      setEpoch(n => n + 1);
    };

    stop = subscribeTick(now => {
      const current = shape.current;
      const node = ref.current;
      if (current === null || node === null) return settle();
      const t = clock(now, wait.current);
      if (t >= 1) return settle();
      const text = render(current, current.target * (1 - (1 - t) ** 4));
      const decoding = Math.ceil(digitCount(text) * Math.max(0, 1 - t / DECODE_SHARE));
      node.textContent = scramble(text, decoding);
    });

    return () => {
      if (!stop) return;
      // Cut short (unmount, or the reveal ended): the node still holds a frame,
      // so it is handed back to React, and a later mount may count again.
      stop();
      setEpoch(n => n + 1);
    };
  }, [animate, ref]);

  return epoch;
}

/** Row index for the reveal stagger; every animated descendant reads it as `--i`. */
export function staggerIndex(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}
