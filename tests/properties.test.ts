/**
 * Property tests: statements that must hold for ANY valid input, checked on
 * hundreds of randomly generated covariance matrices and targets.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  checkPortfolio,
  cholesky,
  determinant,
  frontierVariance,
  identity,
  inverse,
  isPositiveDefinite,
  lagrangeConstants,
  linearWeightForm,
  maxAbsDiff,
  minor,
  multiply,
  optimalWeights,
  portfolioReturn,
  portfolioVariance,
  sum,
  transpose,
  withCorrelation,
  type Matrix,
} from "@/lib/math";

/** Random symmetric positive-definite n×n matrix: Σ = L Lᵀ with a well-scaled diagonal. */
const spdMatrix = (n: number) =>
  fc
    .array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: n * n, maxLength: n * n })
    .map((xs) => {
      const L: Matrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (j < i ? xs[i * n + j] : j === i ? 0.3 + Math.abs(xs[i * n + j]) : 0)),
      );
      return multiply(L, transpose(L)).map((row) => row.map((v) => v * 0.01)); // monthly-size variances
    });

const muVector = (n: number) =>
  fc
    .array(fc.double({ min: -0.05, max: 0.1, noNaN: true }), { minLength: n, maxLength: n })
    .filter((m) => Math.max(...m) - Math.min(...m) > 0.005); // D > 0 needs means that differ

const target = fc.double({ min: -0.1, max: 0.2, noNaN: true });

describe("matrix properties", () => {
  it("Σ·Σ⁻¹ ≈ I and Σ⁻¹·Σ ≈ I", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 5 }).chain(spdMatrix), (S) => {
        const Si = inverse(S).inverse;
        expect(maxAbsDiff(multiply(S, Si), identity(S.length))).toBeLessThan(1e-8);
        expect(maxAbsDiff(multiply(Si, S), identity(S.length))).toBeLessThan(1e-8);
      }),
    );
  });

  it("Gauss–Jordan inverse equals the adjugate formula M⁻¹ = adj(M)/det(M) for 3×3", () => {
    fc.assert(
      fc.property(spdMatrix(3), (S) => {
        const det = determinant(S);
        const adj = S.map((_, i) => S.map((__, j) => ((i + j) % 2 ? -1 : 1) * determinant(minor(S, j, i))));
        const viaAdj = adj.map((row) => row.map((v) => v / det));
        const scaleRef = Math.max(...viaAdj.flat().map(Math.abs));
        expect(maxAbsDiff(inverse(S).inverse, viaAdj) / scaleRef).toBeLessThan(1e-9);
      }),
    );
  });

  it("recorded row operations end at [I | Σ⁻¹]", () => {
    fc.assert(
      fc.property(spdMatrix(3), (S) => {
        const { steps, inverse: Si } = inverse(S, true);
        const last = steps.at(-1)!.augmented;
        expect(maxAbsDiff(last.map((r) => r.slice(0, 3)), identity(3))).toBeLessThan(1e-10);
        expect(maxAbsDiff(last.map((r) => r.slice(3)), Si)).toBe(0);
      }),
    );
  });

  it("Cholesky reproduces Σ = L Lᵀ", () => {
    fc.assert(
      fc.property(spdMatrix(3), (S) => {
        const L = cholesky(S)!;
        expect(maxAbsDiff(multiply(L, transpose(L)), S)).toBeLessThan(1e-12);
      }),
    );
  });

  it("rejects matrices that are not positive definite", () => {
    expect(isPositiveDefinite([[1, 2], [2, 1]])).toBe(false); // eigenvalues 3 and −1
    expect(isPositiveDefinite([[1, 0], [0, 0]])).toBe(false); // singular
    expect(isPositiveDefinite([[1, 0.5], [0.4, 1]])).toBe(false); // not symmetric
    // Three assets with ρ12 = ρ13 = 0.9 cannot have ρ23 = −0.9
    const S = withCorrelation(withCorrelation(withCorrelation(identity(3), 0, 1, 0.9), 0, 2, 0.9), 1, 2, -0.9);
    expect(isPositiveDefinite(S)).toBe(false);
  });

  it("singular matrix has no inverse", () => {
    expect(() => inverse([[1, 2], [2, 4]])).toThrow(/singular/);
  });
});

describe("Markowitz properties", () => {
  const model = fc.integer({ min: 2, max: 5 }).chain((n) => fc.tuple(spdMatrix(n), muVector(n)));

  it("weights sum to 1, hit the target, and wᵀΣw equals the frontier formula", () => {
    fc.assert(
      fc.property(model, target, ([S, mu], t) => {
        const k = lagrangeConstants(S, mu);
        const p = optimalWeights(k, t);
        expect(sum(p.weights)).toBeCloseTo(1, 8);
        expect(portfolioReturn(p.weights, mu)).toBeCloseTo(t, 8);
        const f = frontierVariance(k, t);
        expect(Math.abs(portfolioVariance(p.weights, S) - f) / f).toBeLessThan(1e-6);
        const c = checkPortfolio(k, p);
        expect(c.weightsSumToOne.ok && c.hitsTarget.ok).toBe(true);
      }),
    );
  });

  it("Σg = 1, Σh = 0, and g + hμ* equals the λ formula", () => {
    fc.assert(
      fc.property(model, target, ([S, mu], t) => {
        const k = lagrangeConstants(S, mu);
        const { g, h } = linearWeightForm(k);
        expect(sum(g)).toBeCloseTo(1, 8);
        expect(sum(h)).toBeCloseTo(0, 6);
        const w = optimalWeights(k, t).weights;
        w.forEach((wi, i) => expect(wi).toBeCloseTo(g[i] + h[i] * t, 6));
      }),
    );
  });

  it("no feasible portfolio has lower variance than the frontier (optimality)", () => {
    fc.assert(
      fc.property(model, target, fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 5 }), ([S, mu], t, noise) => {
        // Perturb the optimum along a direction d with Σd = 0 and dᵀμ = 0: stays feasible.
        const n = mu.length;
        if (n < 3) return;
        const k = lagrangeConstants(S, mu);
        const w = optimalWeights(k, t).weights;
        // project noise onto {d : 1ᵀd = 0, μᵀd = 0} via Gram–Schmidt
        let d = noise.slice(0, n);
        const basis = [new Array(n).fill(1), mu.slice()];
        const ortho: number[][] = [];
        for (const b of basis) {
          let v = b.slice();
          for (const o of ortho) { const c = v.reduce((s, x, i) => s + x * o[i], 0); v = v.map((x, i) => x - c * o[i]); }
          const nv = Math.hypot(...v); if (nv > 1e-12) ortho.push(v.map((x) => x / nv));
        }
        for (const o of ortho) { const c = d.reduce((s, x, i) => s + x * o[i], 0); d = d.map((x, i) => x - c * o[i]); }
        const w2 = w.map((x, i) => x + 0.1 * d[i]);
        expect(portfolioVariance(w2, S)).toBeGreaterThanOrEqual(portfolioVariance(w, S) - 1e-12);
      }),
    );
  });
});
