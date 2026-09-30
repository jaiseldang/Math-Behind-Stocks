/**
 * Brute-force searches. These don't use calculus at all, which makes them a
 * useful independent check on the Lagrange answers.
 */
import type { Vector } from "./stats";
import { seededRandom } from "./analysis";

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

/**
 * The minimum-risk portfolio for a target return WITH the extra rule w ≥ 0
 * (no short-selling), for three assets.
 *
 * On the target line, w₂ and w₃ are linear functions of w₁, so "all weights
 * ≥ 0" cuts the line down to an interval of w₁. Variance is a convex parabola
 * along the line, so golden-section search on that interval finds the minimum.
 * (The general theory is the Karush–Kuhn–Tucker conditions; this is a direct
 * check for our 3-asset case.) Returns null if no long-only mix hits the target.
 */
export function longOnlyOptimum(Sigma: number[][], mu: Vector, target: number): { weights: Vector; variance: number } | null {
  // w₂ = a + b·w₁ from the return constraint; w₃ = 1 − w₁ − w₂
  const b = -(mu[0] - mu[2]) / (mu[1] - mu[2]);
  const a = (target - mu[2]) / (mu[1] - mu[2]);
  const w = (w1: number): Vector => {
    const w2 = a + b * w1;
    return [w1, w2, 1 - w1 - w2];
  };
  // Each weight is linear in w₁: c + d·w₁ ≥ 0
  const lines: [number, number][] = [[0, 1], [a, b], [1 - a, -1 - b]];
  let lo = -Infinity;
  let hi = Infinity;
  for (const [c, d] of lines) {
    if (Math.abs(d) < 1e-15) {
      if (c < -1e-12) return null;
    } else if (d > 0) lo = Math.max(lo, -c / d);
    else hi = Math.min(hi, -c / d);
  }
  if (lo > hi + 1e-12) return null;
  const f = (t: number) => {
    const v = w(t);
    return v.reduce((s, vi, i) => s + vi * Sigma[i].reduce((u, sij, j) => u + sij * v[j], 0), 0);
  };
  const t = lo === hi ? lo : goldenMin(f, lo, hi, 1e-12);
  const weights = w(t).map((x) => (Math.abs(x) < 1e-9 ? 0 : x));
  return { weights, variance: f(t) };
}

/**
 * Bootstrap: resample the months with replacement many times and recompute a
 * statistic, to see how much it would vary with a different sample of months.
 */
export function bootstrap<T>(nMonths: number, reps: number, fn: (idx: number[]) => T, seed = 42): T[] {
  const rand = seededRandom(seed);
  return Array.from({ length: reps }, () => fn(Array.from({ length: nMonths }, () => Math.floor(rand() * nMonths))));
}

/** The q-th quantile (0 ≤ q ≤ 1) of a list, by linear interpolation. */
export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const i = Math.floor(pos);
  return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (pos - i);
}
