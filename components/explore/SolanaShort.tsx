"use client";
import { line } from "d3";
import { useMemo, useState } from "react";
import { Figure } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps } from "@/components/pattern/Stages";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, texMatrixPlain, texNum } from "@/lib/format";
import { betaOnOthers, feasibleCorrelationRange, isPositiveDefinite, lagrangeConstants, minimumVariancePortfolio, withCorrelation } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const OPTIONS = [
  "Because Solana is so risky that holding any of it is bad",
  "Because Solana tends to move with the S&P 500, so a small short cancels some S&P swings",
  "Because the maths rounds small numbers to negative values",
  "Because Solana's average return is too high",
];

export function SolanaShort() {
  const { stats, mvp, k } = useModel();
  const rho0 = stats.correlation[0][2];
  const range = feasibleCorrelationRange(stats.correlation[0][1], stats.correlation[1][2]);
  const [rho, setRho] = useState(Number(rho0.toFixed(2)));
  const S = withCorrelation(stats.Sigma, 0, 2, rho);
  const valid = isPositiveDefinite(S);
  const mv = valid ? minimumVariancePortfolio(lagrangeConstants(S, stats.means)) : null;
  const beta0 = betaOnOthers(stats.Sigma, 2);
  const beta = valid ? betaOnOthers(S, 2) : null;
  const rowSums = k.SigmaInvOnes;

  // Curve of Solana's MVP weight against ρ(S&P, SOL), and the ρ where the short disappears (bisection).
  const curve = useMemo(() => {
    const pts: { r: number; w: number }[] = [];
    for (let r = Math.max(-0.95, range.lower + 0.01); r <= Math.min(0.95, range.upper - 0.01); r += 0.01) {
      const Sr = withCorrelation(stats.Sigma, 0, 2, r);
      if (isPositiveDefinite(Sr)) pts.push({ r, w: minimumVariancePortfolio(lagrangeConstants(Sr, stats.means)).weights[2] });
    }
    return pts;
  }, [stats, range.lower, range.upper]);
  const threshold = useMemo(() => {
    let lo = curve[0]?.r ?? -0.9;
    let hi = rho0;
    const w = (r: number) => minimumVariancePortfolio(lagrangeConstants(withCorrelation(stats.Sigma, 0, 2, r), stats.means)).weights[2];
    if (w(lo) * w(hi) > 0) return null;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (w(mid) * w(lo) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }, [curve, rho0, stats]);

  return (
    <>
      <GuessChoice id="explore-solshort" prompt={`The minimum-risk portfolio holds ${pct(mvp.weights[2], 2)} of Solana: a small short. Why would the safest portfolio bet against the asset with the highest return?`} options={OPTIONS} />
      <Intuition>
        <p>
          The safest mix is mostly S&amp;P 500. Solana tends to rise when the S&amp;P 500 rises (ρ = {rho0.toFixed(2)}) and it swings far more, so it acts like an
          amplified version of the portfolio&apos;s own ups and downs.
        </p>
        <p style={{ marginBottom: 0 }}>
          Holding a little Solana would amplify the swings. Owing a little (a short) dampens them. Because Solana&apos;s own risk enters as w², a tiny short costs almost nothing.
        </p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "\\mathbf w_{\\text{mv}} = \\frac{\\Sigma^{-1}\\mathbf 1}{A}", why: "The minimum-variance weights (vertex of the frontier). A > 0, so each weight has the sign of the matching entry of Σ⁻¹1.", words: "The safest weights are proportional to the row sums of the inverse table." },
          { tex: `\\Sigma^{-1}\\mathbf 1 = ${texMatrixPlain(rowSums.map((x) => [x]), 5)}`, why: "Row sums of Σ⁻¹ with the IA data. The third one (Solana) is negative, so Solana's weight is negative.", words: "Solana's row sum is negative." },
          { tex: "(\\Sigma^{-1}\\mathbf 1)_3 \\;\\propto\\; 1 - \\beta, \\qquad \\beta = \\frac{\\operatorname{cov}(R_{\\text{SOL}},\\, R_P)}{\\operatorname{var}(R_P)}", why: "Block-inverting Σ (splitting it into the S&P/gold block and the Solana row) gives this. P is the lowest-risk mix of S&P and gold alone.", words: "Solana's row sum has the sign of (1 − β), where β measures how much Solana amplifies the S&P/gold mix." },
          { tex: `\\beta = \\frac{${texNum(beta0.covKP, 4)}}{${texNum(beta0.varP, 4)}} = ${texNum(beta0.beta, 4)} > 1`, why: `Solana amplifies the S&P/gold mix about ${beta0.beta.toFixed(1)} times over, so it gets a negative weight.`, words: `On average Solana moves ${beta0.beta.toFixed(1)} times as much as the safe mix, in the same direction.` },
        ]}
      />
      <Experiment>
        <p>Change the S&amp;P–Solana correlation (everything else fixed) and watch Solana&apos;s weight in the safest portfolio.</p>
        <Slider label="ρ(S&P, Solana)" value={rho} min={Math.ceil((range.lower + 0.01) * 100) / 100} max={Math.floor((range.upper - 0.01) * 100) / 100} step={0.01} onChange={setRho} format={(v) => v.toFixed(2)} />
        {!valid || !mv || !beta ? (
          <div className="banner">This correlation is impossible together with the others: Σ would not be positive definite.</div>
        ) : (
          <div className="stats">
            {DEFAULT_ASSETS.map((a, i) => (
              <div className="stat" key={a}><div className="label">{ASSETS[a].name}</div><div className={`value ${mv.weights[i] < 0 ? "neg" : ""}`}>{pct(mv.weights[i], 2)}</div></div>
            ))}
            <div className="stat"><div className="label">β of Solana</div><div className="value">{beta.beta.toFixed(2)}</div><div className="sub">{beta.beta > 1 ? "> 1 → short" : "< 1 → hold"}</div></div>
            <div className="stat"><div className="label">Minimum risk</div><div className="value">{pct(mv.sd, 3)}</div></div>
          </div>
        )}
        <Figure
          title="Solana's weight in the safest portfolio vs its correlation with the S&P 500"
          alt={`Solana's minimum-variance weight rises as the correlation falls. It crosses zero at ρ ≈ ${threshold?.toFixed(3) ?? "—"}.`}
          table={{ header: ["ρ(S&P, SOL)", "Solana weight"], rows: curve.map((c) => [Number(c.r.toFixed(2)), c.w]) }}
          caption="Computed from the current dataset with only the S&P–Solana correlation changed. The slider only allows correlations that keep Σ positive definite."
        >
          <Plot xDomain={[curve[0]?.r ?? -1, curve.at(-1)?.r ?? 1]} yDomain={[Math.min(...curve.map((c) => c.w)) - 0.005, Math.max(...curve.map((c) => c.w)) + 0.005]} xFormat={(v) => v.toFixed(1)} yFormat={(v) => pct(v, 1)} xLabel="Correlation between S&P 500 and Solana" yLabel="Solana weight" zeroLineY>
            {({ x, y }) => (
              <>
                <path d={line<{ r: number; w: number }>().x((c) => x(c.r)).y((c) => y(c.w))(curve) ?? ""} stroke={ASSETS.SOL.color} strokeWidth={2.5} fill="none" />
                {threshold !== null && (
                  <>
                    <circle cx={x(threshold)} cy={y(0)} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
                    <text className="label" x={x(threshold)} y={y(0) - 10} textAnchor="middle">short disappears</text>
                  </>
                )}
                <line x1={x(rho0)} x2={x(rho0)} y1={0} y2={y(Math.min(...curve.map((c) => c.w)) - 0.005)} stroke="var(--c-neutral)" strokeDasharray="4 3" />
                <text x={x(rho0) + 4} y={12} style={{ fontSize: 10 }}>actual ρ</text>
                {mv && <circle cx={x(rho)} cy={y(mv.weights[2])} r={7} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />}
              </>
            )}
          </Plot>
        </Figure>
      </Experiment>
      <Finding
        headline={<>Solana is shorted because it amplifies the safe S&amp;P/gold mix (β = {beta0.beta.toFixed(2)} &gt; 1). The short disappears if the S&amp;P–Solana correlation falls below about {threshold?.toFixed(3) ?? "—"}.</>}
        guessId="explore-solshort"
        compare={(gs) => (gs.value === 1 ? "Correct!" : `It's the second reason: ${OPTIONS[1].toLowerCase()}.`)}
      >
        <p>High average return plays no part: the minimum-variance portfolio ignores means completely (it only uses Σ).</p>
      </Finding>
      <Check>
        <p>
          The weight is Σ⁻¹1 divided by A = {k.A.toFixed(1)}: Solana&apos;s row sum {rowSums[2].toFixed(3)} ÷ {k.A.toFixed(1)} = {(rowSums[2] / k.A).toFixed(5)}, matching the weight {mvp.weights[2].toFixed(5)}.
          And the β-rule predicts the sign correctly for every ρ on the slider (tested on random matrices in the test suite).
        </p>
      </Check>
    </>
  );
}
