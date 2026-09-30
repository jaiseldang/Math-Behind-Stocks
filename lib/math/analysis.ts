/**
 * Glue: from price series to every statistic the site shows.
 * Nothing new mathematically, it just calls the functions in stats.ts.
 */
import type { Matrix, Vector } from "./stats";
import {
  annualiseReturn,
  annualiseStdDev,
  autocorrelation1,
  correlationFromCovariance,
  covarianceMatrix,
  geometricMean,
  mean,
  sampleVariance,
  simpleReturns,
} from "./stats";

export interface SeriesStats {
  returns: Vector[];
  means: Vector;
  variances: Vector;
  sds: Vector;
  geometricMeans: Vector;
  Sigma: Matrix;
  correlation: Matrix;
  annualised: { means: Vector; geometricMeans: Vector; sds: Vector };
}

/** @param prices one price series per asset (same months, oldest first) */
export function analysePrices(prices: Vector[]): SeriesStats {
  return analyseReturns(prices.map(simpleReturns));
}

export function analyseReturns(returns: Vector[]): SeriesStats {
  const Sigma = covarianceMatrix(returns);
  const means = returns.map(mean);
  const variances = Sigma.map((row, i) => row[i]);
  const sds = variances.map(Math.sqrt);
  const geometricMeans = returns.map(geometricMean);
  return {
    returns,
    means,
    variances,
    sds,
    geometricMeans,
    Sigma,
    correlation: correlationFromCovariance(Sigma),
    annualised: {
      means: means.map(annualiseReturn),
      geometricMeans: geometricMeans.map(annualiseReturn),
      sds: sds.map(annualiseStdDev),
    },
  };
}

/**
 * A small seeded pseudo-random generator (mulberry32), so simulations are
 * reproducible: the same seed always gives the same "random" path.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via the Box–Muller transform. */
export function normalSample(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Simulate monthly returns R_t = μ + σ Z_t (Z_t standard normal), clipped at
 * −99% so the price never goes negative. Used for the volatility-drag demo.
 */
export function simulateReturns(mu: number, sigma: number, months: number, seed = 1): Vector {
  const rand = seededRandom(seed);
  return Array.from({ length: months }, () => Math.max(-0.99, mu + sigma * normalSample(rand)));
}

/**
 * Month-end close vs monthly average, on a simulated random walk.
 * Each month has `perMonth` observations; the log-price takes independent
 * normal steps between them. We then compute monthly returns both ways.
 *
 * Theory (Working, 1960): for a random walk, the variance of changes in
 * N-point averages is  σ²_month · (2N² + 1) / (3N²)  → about 2/3 of the
 * month-end variance, and the changes gain a lag-1 autocorrelation near 1/4.
 */
export function averagingExperiment(perMonth: number, months = 2000, monthlySd = 0.05, seed = 7) {
  const rand = seededRandom(seed);
  const stepSd = monthlySd / Math.sqrt(perMonth);
  let logP = Math.log(100);
  const closes: number[] = [];
  const averages: number[] = [];
  for (let m = 0; m < months; m++) {
    let sum = 0;
    for (let k = 0; k < perMonth; k++) {
      logP += stepSd * normalSample(rand);
      sum += Math.exp(logP);
    }
    closes.push(Math.exp(logP));
    averages.push(sum / perMonth);
  }
  const rc = simpleReturns(closes);
  const ra = simpleReturns(averages);
  const sdClose = Math.sqrt(sampleVariance(rc));
  const sdAvg = Math.sqrt(sampleVariance(ra));
  return {
    sdClose,
    sdAvg,
    ratio: sdAvg / sdClose,
    theoryRatio: Math.sqrt((2 * perMonth * perMonth + 1) / (3 * perMonth * perMonth)),
    autocorrClose: autocorrelation1(rc),
    autocorrAvg: autocorrelation1(ra),
  };
}

