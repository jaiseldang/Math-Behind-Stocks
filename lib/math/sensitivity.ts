/**
 * "What-if" helpers: change one input and see how the answer moves.
 */
import type { Matrix } from "./matrix";
import { clone, inverse, isPositiveDefinite } from "./matrix";

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

/**
 * Why an asset is shorted in the minimum-variance portfolio.
 *
 * Let P be the minimum-variance mix of the OTHER assets, and
 *   β = cov(R_k, R_P) / var(R_P)
 * be how strongly asset k amplifies P's swings. Block-inverting Σ shows
 *   (Σ⁻¹1)_k ∝ 1 − β   (with a positive factor),
 * so asset k gets a negative weight exactly when β > 1: adding a little of it
 * would amplify the portfolio's swings, so selling it short dampens them.
 */
export function betaOnOthers(Sigma: Matrix, k: number) {
  const others = Sigma.map((_, i) => i).filter((i) => i !== k);
  const S2 = others.map((i) => others.map((j) => Sigma[i][j]));
  const inv2 = inverse(S2).inverse;
  const a2 = inv2.flat().reduce((s, x) => s + x, 0); // 1ᵀΣ₂⁻¹1
  const wP = inv2.map((row) => row.reduce((s, x) => s + x, 0) / a2); // Σ₂⁻¹1 / 1ᵀΣ₂⁻¹1
  const varP = 1 / a2;
  const covKP = others.reduce((s, i, idx) => s + wP[idx] * Sigma[k][i], 0);
  return { others, weightsP: wP, varP, covKP, beta: covKP / varP };
}

