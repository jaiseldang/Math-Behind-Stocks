import { describe, expect, it } from "vitest";
import {
  annualiseReturn, determinant, geometricMean, inverse, mean, regressionLine,
  sampleCovariance, sampleVariance, simpleReturns,
} from "@/lib/math";

describe("basic statistics (hand-checkable)", () => {
  it("simple returns", () => {
    const r = simpleReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(0.1, 12);
    expect(r[1]).toBeCloseTo(-0.1, 12);
  });
  it("mean and sample variance divide by n − 1", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(sampleVariance([1, 2, 3, 4])).toBeCloseTo(5 / 3, 12); // Σ(x−x̄)² = 5, n−1 = 3
    expect(sampleCovariance([1, 2, 3], [2, 4, 6])).toBeCloseTo(2, 12);
  });
  it("geometric mean of +10% then −10% is negative (volatility drag)", () => {
    expect(geometricMean([0.1, -0.1])).toBeCloseTo(Math.sqrt(0.99) - 1, 12);
    expect(geometricMean([0.5, -1])).toBe(-1);
  });
  it("annualising 1%/month compounds to 12.68%", () => {
    expect(annualiseReturn(0.01)).toBeCloseTo(0.126825, 6);
  });
  it("regression line through exact points", () => {
    const { slope, intercept } = regressionLine([0, 1, 2], [1, 3, 5]);
    expect(slope).toBeCloseTo(2, 12);
    expect(intercept).toBeCloseTo(1, 12);
  });
  it("determinant and inverse of a 3×3 by hand", () => {
    const M = [[2, 0, 1], [1, 3, 2], [1, 1, 2]];
    expect(determinant(M)).toBe(6); // 2(3·2 − 2·1) − 0 + 1(1·1 − 3·1) = 8 − 2
    const Mi = inverse(M).inverse;
    expect(Mi[0][0]).toBeCloseTo(4 / 6, 12); // cofactor C11 = 3·2 − 2·1 = 4
  });
  it("records a row swap when partial pivoting is needed", () => {
    const { steps } = inverse([[1, 2], [3, 4]], true);
    expect(steps[0].kind).toBe("swap");
    expect(steps[0].description).toBe("R1 ↔ R2");
  });
});
