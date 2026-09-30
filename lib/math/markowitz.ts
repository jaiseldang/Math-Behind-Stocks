/**
 * Markowitz minimum-variance portfolios, solved with Lagrange multipliers.
 *
 * Problem: choose weights w (one per asset) to
 *
 *   minimise   f(w) = wᵀ Σ w            (portfolio variance)
 *   subject to wᵀ μ = μ*                 (hit the target return)
 *              wᵀ 1 = 1                  (spend exactly all the money)
 *
 * Lagrangian:  L = wᵀΣw − λ₁(wᵀ1 − 1) − λ₂(wᵀμ − μ*)
 * Setting ∂L/∂w = 0 gives  2Σw = λ₁1 + λ₂μ,  so  w = ½ Σ⁻¹(λ₁1 + λ₂μ).
 * Substituting into the two constraints gives two linear equations in λ₁, λ₂,
 * which involve only four numbers A, B, C, D (below).
 */
import type { Matrix, Vector } from "./matrix";
import { add, dot, inverse, matVec, ones, quadraticForm, scale, sub, sum } from "./matrix";

export interface LagrangeConstants {
  /** A = 1ᵀΣ⁻¹1 */
  A: number;
  /** B = 1ᵀΣ⁻¹μ */
  B: number;
  /** C = μᵀΣ⁻¹μ */
  C: number;
  /** D = AC − B²  (> 0 whenever the assets don't all have the same mean) */
  D: number;
  SigmaInv: Matrix;
  /** Σ⁻¹1: its entries are the row sums of Σ⁻¹ */
  SigmaInvOnes: Vector;
  /** Σ⁻¹μ */
  SigmaInvMu: Vector;
  mu: Vector;
  Sigma: Matrix;
}

/**
 * Compute A, B, C, D:
 *
 *   A = 1ᵀΣ⁻¹1,   B = 1ᵀΣ⁻¹μ,   C = μᵀΣ⁻¹μ,   D = AC − B²
 */
export function lagrangeConstants(Sigma: Matrix, mu: Vector): LagrangeConstants {
  const SigmaInv = inverse(Sigma).inverse;
  const one = ones(mu.length);
  const SigmaInvOnes = matVec(SigmaInv, one);
  const SigmaInvMu = matVec(SigmaInv, mu);
  const A = dot(one, SigmaInvOnes);
  const B = dot(one, SigmaInvMu);
  const C = dot(mu, SigmaInvMu);
  return { A, B, C, D: A * C - B * B, SigmaInv, SigmaInvOnes, SigmaInvMu, mu, Sigma };
}

export interface OptimalPortfolio {
  target: number;
  lambda1: number;
  lambda2: number;
  weights: Vector;
  /** wᵀΣw computed directly from the weights */
  variance: number;
  sd: number;
}

/**
 * Optimal weights for a target return μ*.
 *
 * The constraints become
 *   A λ₁ + B λ₂ = 2
 *   B λ₁ + C λ₂ = 2μ*
 * whose solution (Cramer's rule) is
 *   λ₁ = 2(C − Bμ*)/D,   λ₂ = 2(Aμ* − B)/D
 * and then  w = ½ Σ⁻¹(λ₁1 + λ₂μ) = ½(λ₁ Σ⁻¹1 + λ₂ Σ⁻¹μ).
 */
export function optimalWeights(k: LagrangeConstants, target: number): OptimalPortfolio {
  const lambda1 = (2 * (k.C - k.B * target)) / k.D;
  const lambda2 = (2 * (k.A * target - k.B)) / k.D;
  const weights = scale(0.5, add(scale(lambda1, k.SigmaInvOnes), scale(lambda2, k.SigmaInvMu)));
  const variance = quadraticForm(weights, k.Sigma);
  return { target, lambda1, lambda2, weights, variance, sd: Math.sqrt(variance) };
}

/**
 * The weights are a straight-line function of the target:  w(μ*) = g + h μ*.
 * Expanding the formula above:
 *
 *   g = (C Σ⁻¹1 − B Σ⁻¹μ) / D
 *   h = (A Σ⁻¹μ − B Σ⁻¹1) / D
 *
 * Σg = (CA − B²)/D = 1 and Σh = (AB − BA)/D = 0: raising the target only
 * moves money between assets; it never creates or destroys any.
 */
export function linearWeightForm(k: LagrangeConstants): { g: Vector; h: Vector } {
  const g = scale(1 / k.D, sub(scale(k.C, k.SigmaInvOnes), scale(k.B, k.SigmaInvMu)));
  const h = scale(1 / k.D, sub(scale(k.A, k.SigmaInvMu), scale(k.B, k.SigmaInvOnes)));
  return { g, h };
}

export interface ZeroCrossingResult {
  /** μ_i = −g_i/h_i: the target at which asset i's weight is exactly zero (null if h_i = 0). */
  crossings: (number | null)[];
  /**
   * Targets for which every weight is ≥ 0 (no short-selling), or null if none.
   * Each weight g_i + h_i μ* is a straight line, so each one is ≥ 0 on a half-line;
   * the interval is the overlap of those half-lines.
   */
  noShortInterval: { lower: number; upper: number } | null;
}

/** Where each weight line crosses zero, and the no-short-selling interval. */
export function zeroCrossings(k: LagrangeConstants): ZeroCrossingResult {
  const { g, h } = linearWeightForm(k);
  let lower = -Infinity;
  let upper = Infinity;
  const crossings = g.map((gi, i) => {
    const hi = h[i];
    if (Math.abs(hi) < 1e-15) {
      if (gi < 0) { lower = Infinity; upper = -Infinity; } // never ≥ 0
      return null;
    }
    const z = -gi / hi;
    if (hi > 0) lower = Math.max(lower, z); // rising line: ≥ 0 to the right of z
    else upper = Math.min(upper, z); //         falling line: ≥ 0 to the left of z
    return z;
  });
  return { crossings, noShortInterval: lower <= upper ? { lower, upper } : null };
}

/**
 * Variance on the frontier as a function of the target (a parabola in μ*):
 *
 *   σ²(μ*) = (Aμ*² − 2Bμ* + C) / D
 *
 * Derivation: σ² = wᵀΣw = ½ wᵀ(λ₁1 + λ₂μ) = ½(λ₁ + λ₂μ*); substitute λ₁, λ₂.
 */
export function frontierVariance(k: LagrangeConstants, target: number): number {
  return (k.A * target * target - 2 * k.B * target + k.C) / k.D;
}

/**
 * The global minimum-variance portfolio (the vertex of the parabola).
 * dσ²/dμ* = (2Aμ* − 2B)/D = 0  ⇒  μ = B/A, and then σ² = 1/A, w = Σ⁻¹1 / A.
 */
export function minimumVariancePortfolio(k: LagrangeConstants) {
  const weights = scale(1 / k.A, k.SigmaInvOnes);
  return { mu: k.B / k.A, variance: 1 / k.A, sd: Math.sqrt(1 / k.A), weights };
}

/**
 * Asymptotes of the frontier in the (σ, μ) plane.
 * Completing the square, Aμ² − 2Bμ + C = A(μ − B/A)² + D/A, so
 *   Dσ² = A(μ − B/A)² + D/A   ⇒   (μ − B/A)² = (D/A)(σ² − 1/A),
 * a hyperbola with vertex (1/√A, B/A).
 * For large σ the "− 1/A" is negligible, so μ ≈ B/A ± √(D/A)·σ.
 * The slope √(D/A) is the extra monthly return per unit of extra risk far from the vertex.
 */
export function asymptotes(k: LagrangeConstants) {
  const slope = Math.sqrt(k.D / k.A);
  return {
    intercept: k.B / k.A,
    slope,
    upper: (sigma: number) => k.B / k.A + slope * sigma,
    lower: (sigma: number) => k.B / k.A - slope * sigma,
  };
}

export interface FrontierPoint {
  mu: number;
  sd: number;
  variance: number;
  weights: Vector;
}

/** Points on the frontier for targets from → to in steps of `step`. */
export function frontierPoints(k: LagrangeConstants, from: number, to: number, step: number): FrontierPoint[] {
  if (!(step > 0)) throw new Error("step must be positive");
  const { g, h } = linearWeightForm(k);
  const n = Math.floor((to - from) / step + 1e-9);
  const pts: FrontierPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const mu = from + i * step;
    const variance = frontierVariance(k, mu);
    pts.push({ mu, variance, sd: Math.sqrt(variance), weights: add(g, scale(mu, h)) });
  }
  return pts;
}

/** Portfolio return wᵀμ */
export function portfolioReturn(w: Vector, mu: Vector): number {
  return dot(w, mu);
}

/** Portfolio variance wᵀΣw */
export function portfolioVariance(w: Vector, Sigma: Matrix): number {
  return quadraticForm(w, Sigma);
}

/**
 * The individual terms of wᵀΣw for a breakdown chart.
 * Diagonal terms w_i²σ_i² and cross terms 2 w_i w_j σ_ij (i < j).
 */
export function varianceTerms(w: Vector, Sigma: Matrix) {
  const terms: { i: number; j: number; value: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    for (let j = i; j < w.length; j++) {
      const factor = i === j ? 1 : 2;
      terms.push({ i, j, value: factor * w[i] * w[j] * Sigma[i][j] });
    }
  }
  return terms;
}

/** Check helpers bundled for the API's `checks` block. */
export function checkPortfolio(k: LagrangeConstants, p: OptimalPortfolio) {
  const weightSum = sum(p.weights);
  const achievedReturn = dot(p.weights, k.mu);
  const formulaVariance = frontierVariance(k, p.target);
  return {
    weightsSumToOne: { value: weightSum, ok: Math.abs(weightSum - 1) < 1e-9 },
    hitsTarget: { value: achievedReturn, ok: Math.abs(achievedReturn - p.target) < 1e-9 },
    varianceMatchesFrontier: {
      direct: p.variance,
      formula: formulaVariance,
      ok: Math.abs(p.variance - formulaVariance) < 1e-9 * Math.max(1, formulaVariance),
    },
  };
}
