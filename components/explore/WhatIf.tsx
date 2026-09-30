"use client";
import { useMemo, useState } from "react";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps } from "@/components/pattern/Stages";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { monthLabel, pct } from "@/lib/format";
import {
  analysePrices, covarianceFromCorrelation, isPositiveDefinite, lagrangeConstants, minimumVariancePortfolio,
  optimalWeights, withCorrelation, zeroCrossings, type Matrix, type Vector,
} from "@/lib/math";
import { useModel } from "@/lib/useModel";

const PAIRS: [number, number][] = [[0, 1], [0, 2], [1, 2]];
const pairName = ([i, j]: [number, number]) => `${ASSETS[DEFAULT_ASSETS[i]].short}–${ASSETS[DEFAULT_ASSETS[j]].short}`;

function summarise(S: Matrix, mu: Vector) {
  const k = lagrangeConstants(S, mu);
  const mv = minimumVariancePortfolio(k);
  const at2 = optimalWeights(k, 0.02);
  return { mv, at2, band: zeroCrossings(k).noShortInterval };
}

export function WhatIf() {
  const base = useModel();
  const [dropStart, setDropStart] = useState(0);
  const [dropEnd, setDropEnd] = useState(0);
  const [rhoOverride, setRhoOverride] = useState<(number | null)[]>([null, null, null]);
  const [api, setApi] = useState<string | null>(null);

  const scenario = useMemo(() => {
    const a = dropStart;
    const b = base.months.length - dropEnd;
    const s = analysePrices(base.prices.map((p) => p.slice(a, b)));
    const rho = s.correlation.map((r) => r.slice());
    PAIRS.forEach(([i, j], n) => {
      if (rhoOverride[n] !== null) rho[i][j] = rho[j][i] = rhoOverride[n]!;
    });
    const S = covarianceFromCorrelation(s.sds, rho);
    const pd = isPositiveDefinite(S);
    return { s, rho, S, pd, from: base.months[a], to: base.months[b - 1], n: b - a - 1, result: pd ? summarise(S, s.means) : null };
  }, [base, dropStart, dropEnd, rhoOverride]);

  const baseline = summarise(base.stats.Sigma, base.stats.means);
  const drop6 = useMemo(() => summarise(analysePrices(base.prices.map((p) => p.slice(6))).Sigma, analysePrices(base.prices.map((p) => p.slice(6))).means), [base]);
  const shift = drop6.band && baseline.band ? Math.max(Math.abs(drop6.band.lower - baseline.band.lower), Math.abs(drop6.band.upper - baseline.band.upper)) : Infinity;
  const guessAnswer = !drop6.band ? 2 : shift < 0.001 ? 0 : 1;
  const OPTIONS = ["Barely move (less than 0.1 percentage points)", "Shift noticeably", "Disappear completely"];
  const n = base.stats.returns[0].length;
  const sens = [-0.5, 0, 0.5].map((r) => minimumVariancePortfolio(lagrangeConstants(withCorrelation(base.stats.Sigma, 0, 1, r), base.stats.means)).sd);

  const row = (label: string, f: (r: ReturnType<typeof summarise>) => string) => (
    <tr key={label}>
      <td>{label}</td>
      <td>{f(baseline)}</td>
      <td>{scenario.result ? f(scenario.result) : "—"}</td>
    </tr>
  );
  const bandStr = (r: ReturnType<typeof summarise>) => (r.band ? `${pct(r.band.lower, 2)} – ${pct(r.band.upper, 2)}` : "none");

  const checkApi = async () => {
    setApi("…");
    const r = rhoOverride[0] ?? base.stats.correlation[0][1];
    try {
      const res = await fetch(`/api/explore/sensitivity?source=snapshot&pair=SPX,XAU&rho=${r.toFixed(4)}`);
      const b = await res.json();
      setApi(res.ok && b.results[0].ok ? `API (snapshot data, only S&P–gold ρ changed to ${r.toFixed(2)}): minimum σ = ${pct(b.results[0].minimumVariance.sd, 4)}` : `API: ${b.results?.[0]?.error ?? b.error}`);
    } catch (e) {
      setApi(`API unreachable: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <GuessChoice id="explore-whatif" prompt="Suppose we drop the first 6 months of data (Aug 2023 – Jan 2024, when Solana more than quadrupled). What happens to the no-short-selling band?" options={OPTIONS} />
      <Intuition>
        <p>
          Every input was <em>estimated</em> from only {n} months. It&apos;s like measuring a table with a wobbly ruler: the next measurement would differ a bit.
          If the answer moves a lot when the inputs wobble a little, we should not trust its later decimal places.
        </p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "\\operatorname{SE}(\\bar R) = \\frac{s}{\\sqrt n}", why: "The standard error of a mean shrinks only with √n. With n = 36, √n = 6.", words: "The uncertainty in an average is the spread divided by the square root of the number of months." },
          {
            tex: DEFAULT_ASSETS.map((a, i) => `\\text{${ASSETS[a].short.replace("&", "\\&")}}: ${(base.stats.means[i] * 100).toFixed(2)}\\% \\pm ${((base.stats.sds[i] / Math.sqrt(n)) * 100).toFixed(2)}\\%`).join(",\\quad "),
            why: "Solana's mean is uncertain by about ±4.5 percentage points: it could plausibly be anywhere from about 2% to 11% a month.",
            words: "Solana's average is very uncertain.",
          },
          { tex: "\\operatorname{SE}(r) \\approx \\frac{1 - \\rho^2}{\\sqrt n} \\approx 0.17", why: "Correlations estimated from 36 months are uncertain by roughly ±0.17: the S&P–gold correlation of −0.08 is not clearly different from 0.", words: "Correlations are uncertain by about 0.17 either way." },
          { tex: "\\mathbf w = \\mathbf g + \\mathbf h\\mu^*,\\quad \\mathbf g, \\mathbf h \\text{ depend on } \\Sigma^{-1}", why: "The weights depend on the inverse of Σ, which can magnify small changes in Σ. That is why the answer can be sensitive.", words: "The answer depends on the inverse table, which can blow up small errors." },
        ]}
      />
      <Experiment>
        <p>Change the data window or override any correlation. Impossible combinations are caught by the positive-definite check.</p>
        <Slider label="Drop first months" value={dropStart} min={0} max={12} step={1} onChange={setDropStart} format={(v) => String(v)} />
        <Slider label="Drop last months" value={dropEnd} min={0} max={12} step={1} onChange={setDropEnd} format={(v) => String(v)} />
        <p className="note">Window: {monthLabel(scenario.from)} – {monthLabel(scenario.to)} ({scenario.n} monthly returns)</p>
        {PAIRS.map((p, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Slider
                label={`ρ ${pairName(p)}`}
                value={rhoOverride[idx] ?? scenario.s.correlation[p[0]][p[1]]}
                min={-0.99}
                max={0.99}
                step={0.01}
                onChange={(v) => setRhoOverride(rhoOverride.map((r, i) => (i === idx ? v : r)))}
                format={(v) => v.toFixed(2) + (rhoOverride[idx] === null ? " (data)" : "")}
              />
            </div>
            {rhoOverride[idx] !== null && <button className="btn" onClick={() => setRhoOverride(rhoOverride.map((r, i) => (i === idx ? null : r)))}>reset</button>}
          </div>
        ))}
        {!scenario.pd && (
          <div className="banner" role="alert">
            <strong>Impossible correlations.</strong> With ρ = ({scenario.rho[0][1].toFixed(2)}, {scenario.rho[0][2].toFixed(2)}, {scenario.rho[1][2].toFixed(2)}), the Cholesky test fails: Σ is not
            positive definite, so some portfolio would have negative variance. Move a slider back.
          </div>
        )}
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Quantity</th><th>Full data</th><th>Your scenario</th></tr></thead>
            <tbody>
              {row("No-short band", bandStr)}
              {row("Min-variance σ", (r) => pct(r.mv.sd, 3))}
              {DEFAULT_ASSETS.map((a, i) => row(`Min-variance w (${ASSETS[a].short})`, (r) => pct(r.mv.weights[i], 1)))}
              {DEFAULT_ASSETS.map((a, i) => row(`w at 2% (${ASSETS[a].short})`, (r) => pct(r.at2.weights[i], 1)))}
              {row("σ at 2%", (r) => pct(r.at2.sd, 3))}
            </tbody>
          </table>
        </div>
        <div className="btn-row"><button className="btn" onClick={checkApi}>Check S&amp;P–gold ρ with the API</button>{api && <span className="note" style={{ alignSelf: "center" }}>{api}</span>}</div>
      </Experiment>
      <Finding
        headline={
          <>
            Dropping just the first 6 months moves the no-short band from {bandStr(baseline)} to {bandStr(drop6)}: the answer is sensitive to which months are used.
          </>
        }
        guessId="explore-whatif"
        compare={(gs) => (gs.value === guessAnswer ? "Correct!" : `Actually it would ${OPTIONS[guessAnswer].toLowerCase()}.`)}
      >
        <p>
          The <em>method</em> is exact, but its inputs are noisy. The IA&apos;s numbers should be read as “about 2% to 3% a month” rather than to four decimal places.
        </p>
      </Finding>
      <Check>
        <p>The IA&apos;s own sensitivity test (only the S&amp;P–gold correlation changed), recomputed live:</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>ρ(S&amp;P, gold)</th><th>Minimum σ (here)</th><th>IA value</th></tr></thead>
            <tbody>
              {[-0.5, 0, 0.5].map((r, i) => (
                <tr key={r}><td>{r}</td><td>{sens[i].toFixed(6)}</td><td>{["0.017091", "0.024780", "0.029772"][i]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Check>
    </>
  );
}
