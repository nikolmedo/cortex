/**
 * Organic floating drift applied per node on top of the settled layout.
 * Amplitude (±4 / ±3 px) is strictly below the collision padding (14 px),
 * so the motion can never produce visual overlap.
 */
export function floatOffset(k: number, t: number): { dx: number; dy: number } {
  const TAU = 2 * Math.PI;
  const fk = 0.0004 + (k % 7) * 0.00003;
  const gk = 0.0003 + (k % 11) * 0.000025;
  const phi = ((k * 137.508 * Math.PI) / 180) % TAU;
  const psi = ((k * 97.321 * Math.PI) / 180) % TAU;
  return {
    dx: 4 * Math.sin(t * fk + phi),
    dy: 3 * Math.cos(t * gk + psi),
  };
}
