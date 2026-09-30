/**
 * The 3-asset problem drawn in 2D.
 *
 * Substituting w₃ = 1 − w₁ − w₂ removes the budget constraint, so every
 * fully-invested portfolio is a point (w₁, w₂) in the plane.
 */
import type { Matrix, Vector } from "./stats";
import { matVec, quadraticForm } from "./matrix";

/** (w₁, w₂) → (w₁, w₂, 1 − w₁ − w₂) */
export const fullWeights = (w1: number, w2: number): Vector => [w1, w2, 1 - w1 - w2];

/** f(w₁, w₂) = wᵀΣw with w₃ substituted: a quadratic "bowl" whose level curves are ellipses. */
export function planeVariance(S: Matrix, w1: number, w2: number): number {
  return quadraticForm(fullWeights(w1, w2), S);
}

/**
 * ∇f = (∂f/∂w₁, ∂f/∂w₂). By the chain rule, with ∂w₃/∂w₁ = ∂w₃/∂w₂ = −1:
 *   ∂f/∂w₁ = 2(Σw)₁ − 2(Σw)₃,   ∂f/∂w₂ = 2(Σw)₂ − 2(Σw)₃
 */
export function planeGradient(S: Matrix, w1: number, w2: number): [number, number] {
  const Sw = matVec(S, fullWeights(w1, w2));
  return [2 * (Sw[0] - Sw[2]), 2 * (Sw[1] - Sw[2])];
}

/**
 * Target-return constraint as a line:
 *   g(w₁, w₂) = w₁(μ₁ − μ₃) + w₂(μ₂ − μ₃) = μ* − μ₃,   ∇g = (μ₁ − μ₃, μ₂ − μ₃)
 */
export function constraintGradient(mu: Vector): [number, number] {
  return [mu[0] - mu[2], mu[1] - mu[2]];
}

/** The point on the constraint line with a given w₁. */
export function lineW2(mu: Vector, target: number, w1: number): number {
  return (target - mu[2] - w1 * (mu[0] - mu[2])) / (mu[1] - mu[2]);
}

/** Closest point on the constraint line to (a, b) (orthogonal projection). */
export function projectOntoLine(mu: Vector, target: number, a: number, b: number): [number, number] {
  const [gx, gy] = constraintGradient(mu);
  const c = target - mu[2];
  const t = (gx * a + gy * b - c) / (gx * gx + gy * gy);
  return [a - t * gx, b - t * gy];
}
