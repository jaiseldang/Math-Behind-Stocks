/**
 * The work behind each endpoint, independent of Next.js so it can be tested
 * directly. Each function takes a loaded dataset and returns a plain object.
 */
import { ASSETS, type AssetId } from "@/lib/assets";
import type { MonthlyDataset } from "@/lib/data/types";
import {
  analysePrices,
  asymptotes,
  checkPortfolio,
  determinant,
  feasibleCorrelationRange,
  frontierPoints,
  inverse,
  isPositiveDefinite,
  lagrangeConstants,
  linearWeightForm,
  minimumVariancePortfolio,
  optimalWeights,
  simpleReturns,
  withCorrelation,
  zeroCrossings,
} from "@/lib/math";
import { Unprocessable } from "./http";

const byAsset = <T>(assets: AssetId[], values: T[]) => Object.fromEntries(assets.map((a, i) => [a, values[i]])) as Record<AssetId, T>;

export function provenanceBlock(ds: MonthlyDataset) {
  return {
    source: ds.source,
    method: ds.method,
    months: { from: ds.months[0], to: ds.months.at(-1), count: ds.months.length },
    fallback: ds.provenance.some((p) => p.fallback),
    warnings: ds.warnings,
    assets: ds.provenance,
  };
}

export function pricesPayload(ds: MonthlyDataset) {
  return {
    assets: ds.assets,
    months: ds.months,
    prices: byAsset(ds.assets, ds.prices),
    rows: ds.months.map((m, t) => ({ month: m, ...byAsset(ds.assets, ds.prices.map((p) => p[t])) })),
    provenance: provenanceBlock(ds),
  };
}

export function returnsPayload(ds: MonthlyDataset) {
  const returns = ds.prices.map(simpleReturns);
  const months = ds.months.slice(1);
  return {
    assets: ds.assets,
    formula: "R_t = P_t / P_{t-1} - 1",
    months,
    returns: byAsset(ds.assets, returns),
    rows: months.map((m, t) => ({ month: m, ...byAsset(ds.assets, returns.map((r) => r[t])) })),
    provenance: provenanceBlock(ds),
  };
}

export function statsPayload(ds: MonthlyDataset) {
  const s = analysePrices(ds.prices);
  return {
    assets: ds.assets,
    n: s.returns[0].length,
    divisor: "n - 1 (sample statistics)",
    mean: byAsset(ds.assets, s.means),
    variance: byAsset(ds.assets, s.variances),
    sd: byAsset(ds.assets, s.sds),
    geometricMean: byAsset(ds.assets, s.geometricMeans),
    covariance: s.Sigma,
    correlation: s.correlation,
    annualised: {
      note: "means compounded: (1+μ)^12 − 1; standard deviations × √12",
      mean: byAsset(ds.assets, s.annualised.means),
      geometricMean: byAsset(ds.assets, s.annualised.geometricMeans),
      sd: byAsset(ds.assets, s.annualised.sds),
    },
    provenance: provenanceBlock(ds),
  };
}

function model(ds: MonthlyDataset) {
  const s = analysePrices(ds.prices);
  if (!isPositiveDefinite(s.Sigma)) throw new Unprocessable("the covariance matrix is not positive definite for this data");
  return { s, k: lagrangeConstants(s.Sigma, s.means) };
}

export function optimizePayload(ds: MonthlyDataset, targetReturn: number, amount: number, includeSteps = false) {
  const { s, k } = model(ds);
  const p = optimalWeights(k, targetReturn);
  const inv = inverse(s.Sigma, includeSteps);
  return {
    assets: ds.assets,
    targetReturn,
    amount,
    mu: byAsset(ds.assets, s.means),
    Sigma: s.Sigma,
    SigmaInverse: k.SigmaInv,
    detSigma: determinant(s.Sigma),
    A: k.A,
    B: k.B,
    C: k.C,
    D: k.D,
    lambda1: p.lambda1,
    lambda2: p.lambda2,
    weights: byAsset(ds.assets, p.weights),
    dollars: byAsset(ds.assets, p.weights.map((w) => w * amount)),
    shortSelling: p.weights.some((w) => w < 0),
    variance: p.variance,
    volatility: p.sd,
    checks: checkPortfolio(k, p),
    ...(includeSteps ? { inversionSteps: inv.steps } : {}),
    provenance: provenanceBlock(ds),
  };
}

export function frontierPayload(ds: MonthlyDataset, fromMu: number, toMu: number, step: number) {
  if (!(step > 0)) throw new Unprocessable("step must be positive");
  if ((toMu - fromMu) / step > 5000) throw new Unprocessable("too many points: increase step or narrow the range");
  const { k } = model(ds);
  const mvp = minimumVariancePortfolio(k);
  const asy = asymptotes(k);
  const { g, h } = linearWeightForm(k);
  const z = zeroCrossings(k);
  return {
    assets: ds.assets,
    formula: "sigma^2(mu*) = (A mu*^2 - 2 B mu* + C) / D",
    constants: { A: k.A, B: k.B, C: k.C, D: k.D },
    points: frontierPoints(k, fromMu, toMu, step).map((pt) => ({ ...pt, weights: byAsset(ds.assets, pt.weights) })),
    minimumVariance: { mu: mvp.mu, variance: mvp.variance, sd: mvp.sd, weights: byAsset(ds.assets, mvp.weights) },
    asymptotes: { intercept: asy.intercept, slope: asy.slope, equation: "mu = B/A ± sqrt(D/A)·sigma" },
    linearForm: { g: byAsset(ds.assets, g), h: byAsset(ds.assets, h) },
    zeroCrossings: byAsset(ds.assets, z.crossings),
    noShortSelling: z.noShortInterval,
    provenance: provenanceBlock(ds),
  };
}

export function sensitivityPayload(ds: MonthlyDataset, pair: [AssetId, AssetId], rhos: number[]) {
  const i = ds.assets.indexOf(pair[0]);
  const j = ds.assets.indexOf(pair[1]);
  if (i < 0 || j < 0) throw new Unprocessable("both assets in `pair` must be in `assets`");
  if (i === j) throw new Unprocessable("pair must name two different assets");
  const { s, k } = model(ds);
  const base = minimumVariancePortfolio(k);
  // For three assets, the ρ values that keep Σ positive definite form an interval.
  let feasible: { lower: number; upper: number } | null = null;
  if (ds.assets.length === 3) {
    const other = [0, 1, 2].find((x) => x !== i && x !== j)!;
    feasible = feasibleCorrelationRange(s.correlation[i][other], s.correlation[j][other]);
  }
  const results = rhos.map((rho) => {
    if (rho < -1 || rho > 1) return { rho, ok: false, error: "correlation must be between −1 and 1" };
    const S = withCorrelation(s.Sigma, i, j, rho);
    if (!isPositiveDefinite(S)) {
      return {
        rho,
        ok: false,
        positiveDefinite: false,
        error: `With ρ(${pair[0]}, ${pair[1]}) = ${rho}, Σ is not positive definite (Cholesky failed): some portfolio would have negative variance, so this combination of correlations is impossible.`,
      };
    }
    const mvp = minimumVariancePortfolio(lagrangeConstants(S, s.means));
    return { rho, ok: true, positiveDefinite: true, minimumVariance: { mu: mvp.mu, sd: mvp.sd, weights: byAsset(ds.assets, mvp.weights) } };
  });
  if (results.every((r) => !r.ok)) {
    const range = feasible ? ` Allowed range: ${feasible.lower.toFixed(3)} < ρ < ${feasible.upper.toFixed(3)}.` : "";
    throw new Unprocessable(`None of the requested ρ values gives a positive definite covariance matrix.${range}`, { results, feasibleRange: feasible });
  }
  return {
    assets: ds.assets,
    pair,
    pairNames: pair.map((a) => ASSETS[a].name),
    originalRho: s.correlation[i][j],
    feasibleRange: feasible,
    baseline: { mu: base.mu, sd: base.sd, weights: byAsset(ds.assets, base.weights) },
    results,
    provenance: provenanceBlock(ds),
  };
}
