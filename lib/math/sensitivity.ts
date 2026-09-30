/**
 * "What-if" helpers: change one input and see how the answer moves.
 */
import type { Matrix } from "./matrix";
import { clone, isPositiveDefinite } from "./matrix";

/**
 * Replace the correlation between assets i and j with ρ, keeping both
 * variances unchanged:
 *
 *   σ_ij = σ_ji = ρ · σ_i · σ_j
 *
 * The result may no longer be a valid covariance matrix (e.g. if ρ contradicts
 * the other correlations), so always check isPositiveDefinite afterwards.
 */
export function withCorrelation(Sigma: Matrix, i: number, j: number, rho: number): Matrix {
  if (i === j) throw new Error("i and j must be different assets");
  if (rho < -1 || rho > 1) throw new Error("correlation must be between −1 and 1");
  const S = clone(Sigma);
  const c = rho * Math.sqrt(Sigma[i][i] * Sigma[j][j]);
  S[i][j] = c;
  S[j][i] = c;
  return S;
}

/**
 * Build a covariance matrix from standard deviations and a correlation matrix:
 *   Σ_ij = ρ_ij σ_i σ_j
 */
export function covarianceFromCorrelation(sd: number[], rho: Matrix): Matrix {
  return rho.map((row, i) => row.map((r, j) => r * sd[i] * sd[j]));
}

/**
 * For three assets with correlations ρ12, ρ13 fixed, the values of ρ23 that keep
 * Σ positive definite form an interval (det of the correlation matrix > 0):
 *
 *   ρ23 ∈ ( ρ12ρ13 − √((1−ρ12²)(1−ρ13²)),  ρ12ρ13 + √((1−ρ12²)(1−ρ13²)) )
 *
 * Useful for greying out impossible values on the what-if sliders.
 */
export function feasibleCorrelationRange(rhoA: number, rhoB: number): { lower: number; upper: number } {
  const r = Math.sqrt((1 - rhoA * rhoA) * (1 - rhoB * rhoB));
  return { lower: rhoA * rhoB - r, upper: rhoA * rhoB + r };
}

export { isPositiveDefinite };
