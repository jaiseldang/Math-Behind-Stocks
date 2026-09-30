/**
 * Descriptive statistics for return series.
 *
 * Conventions used everywhere in this project:
 *  - A "series" is an array of numbers ordered in time (oldest first).
 *  - Sample statistics divide by (n − 1), not n, because we estimate the
 *    population value from a sample (Bessel's correction).
 */

export type Vector = number[];
export type Matrix = number[][];

/**
 * Simple (arithmetic) returns from a price series.
 *
 *   R_t = P_t / P_{t−1} − 1
 *
 * n prices give n − 1 returns.
 */
export function simpleReturns(prices: Vector): Vector {
  const out: Vector = [];
  for (let t = 1; t < prices.length; t++) {
    out.push(prices[t] / prices[t - 1] - 1);
  }
  return out;
}

/** Arithmetic mean:  x̄ = (1/n) Σ x_i */
export function mean(xs: Vector): number {
  if (xs.length === 0) throw new Error("mean of empty series");
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Sample covariance of two equally long series:
 *
 *   s_xy = Σ (x_i − x̄)(y_i − ȳ) / (n − 1)
 */
export function sampleCovariance(xs: Vector, ys: Vector): number {
  if (xs.length !== ys.length) throw new Error("series must have equal length");
  if (xs.length < 2) throw new Error("need at least 2 observations");
  const mx = mean(xs);
  const my = mean(ys);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (xs.length - 1);
}

/** Sample variance:  s² = Σ (x_i − x̄)² / (n − 1)  (covariance of a series with itself) */
export function sampleVariance(xs: Vector): number {
  return sampleCovariance(xs, xs);
}

/** Sample standard deviation:  s = √s² */
export function sampleStdDev(xs: Vector): number {
  return Math.sqrt(sampleVariance(xs));
}

/**
 * Covariance matrix Σ for k assets.
 *
 *   Σ_ij = s_{ij}  (so the diagonal holds the variances σ_i²)
 *
 * @param series one return series per asset, all the same length
 */
export function covarianceMatrix(series: Vector[]): Matrix {
  const k = series.length;
  const S: Matrix = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const c = sampleCovariance(series[i], series[j]);
      S[i][j] = c;
      S[j][i] = c; // Σ is symmetric
    }
  }
  return S;
}

/**
 * Correlation matrix from a covariance matrix.
 *
 *   ρ_ij = σ_ij / (σ_i σ_j)
 *
 * Always 1 on the diagonal and between −1 and 1 elsewhere.
 */
export function correlationFromCovariance(S: Matrix): Matrix {
  const sd = S.map((row, i) => Math.sqrt(row[i]));
  return S.map((row, i) => row.map((v, j) => v / (sd[i] * sd[j])));
}

/** Correlation matrix directly from return series. */
export function correlationMatrix(series: Vector[]): Matrix {
  return correlationFromCovariance(covarianceMatrix(series));
}

/**
 * Geometric mean return (the constant rate that gives the same total growth):
 *
 *   G = ( Π (1 + R_t) )^{1/n} − 1
 *
 * Computed with logarithms to avoid overflow: G = exp( (1/n) Σ ln(1 + R_t) ) − 1.
 */
export function geometricMean(returns: Vector): number {
  if (returns.length === 0) throw new Error("geometric mean of empty series");
  let s = 0;
  for (const r of returns) {
    if (r <= -1) return -1; // total loss: the investment is wiped out
    s += Math.log(1 + r);
  }
  return Math.exp(s / returns.length) - 1;
}

/**
 * Annualise a monthly mean return by compounding: (1 + μ)^12 − 1.
 * (For the arithmetic mean this is an approximation; it is what most
 * textbooks quote.)
 */
export function annualiseReturn(monthly: number): number {
  return Math.pow(1 + monthly, 12) - 1;
}

/**
 * Annualise a monthly standard deviation using the square-root-of-time rule:
 *   σ_annual = σ_monthly · √12
 * This assumes months are independent (variances add, so SDs add in quadrature).
 */
export function annualiseStdDev(monthly: number): number {
  return monthly * Math.sqrt(12);
}

/**
 * Ordinary least-squares regression line y = a + b x.
 *   b = s_xy / s_x²,  a = ȳ − b x̄
 * Used on the risk & correlation page.
 */
export function regressionLine(xs: Vector, ys: Vector): { intercept: number; slope: number } {
  const slope = sampleCovariance(xs, ys) / sampleVariance(xs);
  return { slope, intercept: mean(ys) - slope * mean(xs) };
}

/** Sum of squared vertical distances from points to the line y = a + b x. */
export function sumSquaredResiduals(xs: Vector, ys: Vector, intercept: number, slope: number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    const e = ys[i] - (intercept + slope * xs[i]);
    s += e * e;
  }
  return s;
}

/**
 * Lag-1 autocorrelation: the correlation between each value and the next,
 *   r₁ = Σ (x_t − x̄)(x_{t+1} − x̄) / Σ (x_t − x̄)²
 * Near 0 for independent returns; averaging prices pushes it towards 0.25.
 */
export function autocorrelation1(xs: Vector): number {
  const m = mean(xs);
  let num = 0;
  let den = 0;
  for (let t = 0; t < xs.length; t++) {
    den += (xs[t] - m) ** 2;
    if (t + 1 < xs.length) num += (xs[t] - m) * (xs[t + 1] - m);
  }
  return num / den;
}
