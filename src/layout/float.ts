/**
 * Organic floating drift applied per node on top of the settled layout.
 * `amp` is the horizontal amplitude in px (vertical is 3/4 of it) and must
 * stay below half the collision padding so two neighbours drifting towards
 * each other can never overlap; see floatAmplitude() in sceneMetrics.ts.
 */
export function floatOffset(k: number, t: number, amp: number): { dx: number; dy: number } {
  const TAU = 2 * Math.PI;
  const fk = 0.0004 + (k % 7) * 0.00003;
  const gk = 0.0003 + (k % 11) * 0.000025;
  const phi = ((k * 137.508 * Math.PI) / 180) % TAU;
  const psi = ((k * 97.321 * Math.PI) / 180) % TAU;
  return {
    dx: amp * Math.sin(t * fk + phi),
    dy: amp * 0.75 * Math.cos(t * gk + psi),
  };
}
