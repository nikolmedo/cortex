import { describe, expect, it } from 'vitest';
import { COUNT_MS, countClock } from './useCountUp';

describe('countClock', () => {
  it('starts on the first tick plus the delay of that moment', () => {
    const clock = countClock();
    expect(clock(1000, 300)).toBe(0);
    expect(clock(1200, 300)).toBe(0);
    expect(clock(1300 + COUNT_MS / 2, 300)).toBe(0.5);
    expect(clock(1300 + COUNT_MS, 300)).toBe(1);
  });

  it('never restarts or stalls a count that has begun when the delay changes', () => {
    // A later partial moves the card out of the arriving batch and its delay drops to 0.
    const clock = countClock();
    clock(1000, 300);
    const mid = clock(1300 + COUNT_MS / 2, 0);
    expect(mid).toBe(0.5);
    // A larger delay later on does not push the finish back either.
    expect(clock(1300 + COUNT_MS, 900)).toBe(1);
  });

  it('keeps progressing monotonically to the end', () => {
    const clock = countClock();
    let last = -1;
    for (let now = 0; now <= COUNT_MS + 200; now += 16) {
      const t = clock(now, now < 200 ? 120 : 0);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    expect(last).toBeGreaterThanOrEqual(1);
  });
});
