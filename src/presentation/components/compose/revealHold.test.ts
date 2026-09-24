import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { entrancesPlay, scheduleHold } from './revealHold';

interface Props {
  reveal: boolean;
  live: boolean;
  reduced?: boolean;
}

const TAIL_MS = 1500;

/**
 * Drives the hold the way useRevealHold does under React: state seeded from
 * `reveal`, the effect rerun only when its deps change, cleanup before rerun.
 */
function mount(initial: Props) {
  let props = initial;
  let holding = initial.reveal;
  let deps: unknown[] | null = null;
  let cleanup: (() => void) | undefined;

  const render = () => {
    const arriving = props.reveal && props.live;
    const next = [arriving, holding, TAIL_MS];
    if (deps === null || next.some((d, i) => d !== deps![i])) {
      cleanup?.();
      deps = next;
      cleanup = scheduleHold(arriving, holding, TAIL_MS, value => {
        if (value === holding) return;
        holding = value;
        render();
      });
    }
  };
  render();

  return {
    animate: () => entrancesPlay(props.reveal, props.reveal && props.live, holding, props.reduced ?? false),
    update: (next: Props) => {
      props = next;
      render();
    },
  };
}

describe('reveal hold', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('animates entrances while a streaming turn arrives', () => {
    const turn = mount({ reveal: true, live: true });
    expect(turn.animate()).toBe(true);
    vi.advanceTimersByTime(TAIL_MS * 4);
    expect(turn.animate()).toBe(true);
  });

  it('keeps animating through the tail once the turn resolves, then settles for good', () => {
    const turn = mount({ reveal: true, live: true });
    turn.update({ reveal: true, live: false });
    vi.advanceTimersByTime(TAIL_MS - 1);
    expect(turn.animate()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(turn.animate()).toBe(false);
    // A card remounting now (rail to main across a breakpoint) reads the settled value.
    turn.update({ reveal: true, live: false });
    vi.advanceTimersByTime(TAIL_MS * 4);
    expect(turn.animate()).toBe(false);
  });

  it('still plays once for a turn that resolved in the same update its scene arrived', () => {
    const turn = mount({ reveal: true, live: false });
    expect(turn.animate()).toBe(true);
    vi.advanceTimersByTime(TAIL_MS);
    expect(turn.animate()).toBe(false);
  });

  it('never animates under reduced motion', () => {
    const turn = mount({ reveal: true, live: true, reduced: true });
    expect(turn.animate()).toBe(false);
    turn.update({ reveal: true, live: false, reduced: true });
    expect(turn.animate()).toBe(false);
    vi.advanceTimersByTime(TAIL_MS);
    expect(turn.animate()).toBe(false);
  });

  it('never animates an older turn, even one still in flight', () => {
    const turn = mount({ reveal: false, live: true });
    expect(turn.animate()).toBe(false);
    turn.update({ reveal: false, live: false });
    vi.advanceTimersByTime(TAIL_MS);
    expect(turn.animate()).toBe(false);
  });

  it('stops at once when a newer turn takes over mid-stream', () => {
    const turn = mount({ reveal: true, live: true });
    turn.update({ reveal: false, live: true });
    expect(turn.animate()).toBe(false);
  });

  it('never animates a restored turn that was already resolved', () => {
    const turn = mount({ reveal: false, live: false });
    expect(turn.animate()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
