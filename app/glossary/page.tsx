"use client";
import { M } from "@/components/pattern/Tex";
import { PageHeader } from "@/components/pattern/Stages";

const NOTATION: [string, string, string][] = [
  ["P_t", "price in month t", "2"],
  ["R_t = P_t/P_{t-1} - 1", "simple return in month t", "3"],
  ["\\mu_i \\text{ or } \\bar R_i", "mean (average) monthly return of asset i", "3"],
  ["G", "geometric mean return (steady growth rate)", "3"],
  ["\\sigma_i", "standard deviation of asset i: its risk", "1"],
  ["\\sigma_i^2", "variance of asset i", "4"],
  ["\\sigma_{ij}", "covariance of assets i and j", "4"],
  ["\\rho_{ij}", "correlation of assets i and j (between −1 and 1)", "4"],
  ["w_i", "weight: fraction of the money in asset i", "1"],
  ["\\mathbf w", "column vector of weights", "5"],
  ["\\mathbf 1", "column vector of ones", "5"],
  ["\\boldsymbol\\mu", "column vector of mean returns", "5"],
  ["\\Sigma", "covariance matrix", "5"],
  ["\\Sigma^{-1}", "inverse of the covariance matrix", "7"],
  ["\\mathbf w^{\\mathsf T}\\Sigma\\mathbf w", "portfolio variance", "5"],
  ["\\mu^*", "target monthly return", "6"],
  ["\\lambda_1, \\lambda_2", "Lagrange multipliers (one per constraint)", "6"],
  ["\\nabla f", "gradient: the direction of steepest increase", "6"],
  ["A, B, C, D", "A = 1ᵀΣ⁻¹1, B = 1ᵀΣ⁻¹μ, C = μᵀΣ⁻¹μ, D = AC − B²", "7"],
  ["\\mathbf g, \\mathbf h", "weights as a straight line: w(μ*) = g + hμ*", "8"],
];

const TERMS: [string, string][] = [
  ["Asset", "Something you can invest in. Here: the S&P 500 index, gold and the Solana cryptocurrency."],
  ["Portfolio", "A split of your money between assets, described by the weights."],
  ["Weight", "The fraction of your money in one asset. Weights add up to 1 (100%)."],
  ["Return", "The percentage change in price over a month."],
  ["Arithmetic mean (AM)", "The ordinary average. The model uses it as the expected return."],
  ["Geometric mean (GM)", "The constant growth rate that gives the same total growth as the real ups and downs."],
  ["Volatility drag", "The gap AM − GM, roughly σ²/2: swings reduce long-run growth."],
  ["Risk / volatility", "The standard deviation of monthly returns: how far a typical month is from the average."],
  ["Variance", "Standard deviation squared. Easier to do algebra with."],
  ["Covariance", "Whether two assets tend to be above average in the same months (positive) or opposite months (negative)."],
  ["Correlation", "Covariance rescaled to lie between −1 (perfectly opposite) and +1 (perfectly together)."],
  ["Diversification", "Lowering risk by holding assets that don't move perfectly together."],
  ["Short-selling", "Borrowing an asset and selling it, hoping to buy it back cheaper. It shows up as a negative weight."],
  ["Minimum-variance portfolio", "The mix with the lowest possible risk of all, whatever its return."],
  ["Efficient frontier", "The curve of the lowest possible risk for each target return."],
  ["Lagrange multiplier", "A helper number that turns a constrained problem into ordinary equations. It measures how much the minimum risk changes if a constraint is relaxed."],
  ["Gradient", "The vector of partial derivatives; it points straight uphill."],
  ["Matrix inverse", "The matrix Σ⁻¹ with ΣΣ⁻¹ = I, found here by Gauss–Jordan elimination."],
  ["Positive definite", "A matrix with wᵀΣw > 0 for every non-zero w: every portfolio has positive variance. A real covariance matrix must be one."],
  ["Cholesky decomposition", "Writing Σ = LLᵀ with L lower-triangular. It only works if Σ is positive definite, so it is our test."],
  ["Resampling", "Turning daily or weekly prices into monthly ones (average or month-end close)."],
  ["Provenance", "A record of where data came from: source, URL, date retrieved and method."],
  ["Stationarity", "The assumption that means and covariances stay the same over time."],
  ["KKT conditions", "The extension of Lagrange multipliers to inequality constraints such as w ≥ 0."],
];

export default function Glossary() {
  return (
    <>
      <PageHeader n="·" title="Glossary & notation" lead="Every symbol and term used on this site. Classmate mode (sidebar) swaps symbols for these words." />
      <h2>Notation</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Symbol</th><th style={{ textAlign: "left" }}>Meaning</th><th>First used (page)</th></tr></thead>
          <tbody>
            {NOTATION.map(([s, m, p]) => (
              <tr key={s}><td><M>{s}</M></td><td style={{ textAlign: "left" }}>{m}</td><td>{p}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 32 }}>Glossary</h2>
      <dl>
        {TERMS.map(([t, d]) => (
          <div key={t} style={{ marginBottom: 12 }}>
            <dt style={{ fontWeight: 650 }}>{t}</dt>
            <dd style={{ margin: 0, color: "var(--ink-2)" }}>{d}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
