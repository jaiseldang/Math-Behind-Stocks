/**
 * The bundled snapshot must reproduce every number in the IA.
 * Expected values are written exactly as they appear in the IA; each is
 * checked to the number of significant figures shown.
 */
import { describe, expect, it } from "vitest";
import { expectSig } from "./helpers";
import { snapshotPrices } from "@/lib/data/snapshot";
import {
  analysePrices,
  asymptotes,
  lagrangeConstants,
  linearWeightForm,
  minimumVariancePortfolio,
  optimalWeights,
  sum,
  withCorrelation,
  zeroCrossings,
} from "@/lib/math";

const { prices, months } = snapshotPrices(["SPX", "XAU", "SOL"]);
const stats = analysePrices(prices);
const k = lagrangeConstants(stats.Sigma, stats.means);

describe("snapshot data", () => {
  it("has 37 months (Aug 2023 – Aug 2026) → 36 returns", () => {
    expect(months.length).toBe(37);
    expect(months[0]).toBe("2023-08");
    expect(months.at(-1)).toBe("2026-08");
    expect(stats.returns[0].length).toBe(36);
  });
});

describe("descriptive statistics", () => {
  it("monthly arithmetic means", () => {
    ["0.01582", "0.02426", "0.06506"].forEach((e, i) => expectSig(stats.means[i], e, `mean ${i}`));
  });
  it("monthly sample standard deviations (n − 1)", () => {
    ["0.03135", "0.04275", "0.2686"].forEach((e, i) => expectSig(stats.sds[i], e, `sd ${i}`));
  });
  it("correlations", () => {
    expectSig(stats.correlation[0][1], "-0.0829", "S&P–gold");
    expectSig(stats.correlation[0][2], "0.3412", "S&P–Solana");
    expectSig(stats.correlation[1][2], "0.0159", "gold–Solana");
  });
  it("geometric monthly means", () => {
    ["0.015342", "0.023389", "0.037260"].forEach((e, i) => expectSig(stats.geometricMeans[i], e, `geo ${i}`));
  });
});

describe("Lagrange solution", () => {
  it("A, B, C, D", () => {
    expectSig(k.A, "1778.3", "A");
    expectSig(k.B, "31.661", "B");
    expectSig(k.C, "0.63047", "C");
    expectSig(k.D, "118.75", "D");
  });

  it("minimum-variance portfolio", () => {
    const mvp = minimumVariancePortfolio(k);
    expectSig(mvp.mu, "0.017804", "μ_mvp");
    expectSig(mvp.sd, "0.023713", "σ_mvp");
    ["0.6693", "0.3504", "-0.0197"].forEach((e, i) => expectSig(mvp.weights[i], e, `w_mvp ${i}`));
  });

  it("optimal portfolio at μ* = 0.02", () => {
    const p = optimalWeights(k, 0.02);
    ["0.53736", "0.45586", "0.00678"].forEach((e, i) => expectSig(p.weights[i], e, `w ${i}`));
    expectSig(p.sd, "0.025190", "σ");
    // The IA text quotes λ₁ = −0.0000463; the exact value is −0.00004635…,
    // i.e. −0.0000464 to 3 s.f. We test the 4 s.f. value.
    expectSig(p.lambda1, "-0.00004635", "λ₁");
    expectSig(p.lambda2, "0.065772", "λ₂");
  });

  it("linear form w = g + hμ*", () => {
    const { g, h } = linearWeightForm(k);
    ["1.7394", "-0.50451", "-0.23485"].forEach((e, i) => expectSig(g[i], e, `g ${i}`));
    ["-60.100", "48.018", "12.081"].forEach((e, i) => expectSig(h[i], e, `h ${i}`));
    expect(sum(g)).toBeCloseTo(1, 12);
    expect(sum(h)).toBeCloseTo(0, 10);
  });

  it("no-short-selling interval and asymptote slope", () => {
    const z = zeroCrossings(k);
    expect(z.noShortInterval).not.toBeNull();
    expectSig(z.noShortInterval!.lower, "0.019439", "lower");
    expectSig(z.noShortInterval!.upper, "0.028941", "upper");
    expectSig(asymptotes(k).slope, "0.25841", "√(D/A)");
  });

  it("sensitivity to the S&P–gold correlation", () => {
    const expected: [number, string][] = [[-0.5, "0.017091"], [0, "0.024780"], [0.5, "0.029772"]];
    for (const [rho, e] of expected) {
      const S = withCorrelation(stats.Sigma, 0, 1, rho);
      expectSig(minimumVariancePortfolio(lagrangeConstants(S, stats.means)).sd, e, `ρ=${rho}`);
    }
  });
});
