/**
 * Brute-force searches. These don't use calculus at all, which makes them a
 * useful independent check on the Lagrange answers.
 */
import type { Vector } from "./stats";

/** Every long-only 3-asset mix (w₁, w₂, w₃ ≥ 0, sum 1) on a grid of spacing `step`. */
export function simplexGrid(step = 0.05): Vector[] {
  const n = Math.round(1 / step);
  const out: Vector[] = [];
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n - i; j++) out.push([i / n, j / n, (n - i - j) / n]);
  return out;
}

/** The grid point with the smallest value of f. */
export function gridMinimum(f: (w: Vector) => number, step = 0.005): { weights: Vector; value: number } {
  let best = { weights: [1, 0, 0], value: Infinity };
  for (const w of simplexGrid(step)) {
    const v = f(w);
    if (v < best.value) best = { weights: w, value: v };
  }
  return best;
}

/**
 * Minimise a function of one variable on [a, b] by golden-section search
 * (assumes a single minimum, as for a parabola).
 */
export function goldenMin(f: (t: number) => number, a: number, b: number, tol = 1e-10): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  while (Math.abs(b - a) > tol) {
    if (f(c) < f(d)) b = d;
    else a = c;
    c = b - r * (b - a);
    d = a + r * (b - a);
  }
  return (a + b) / 2;
}
