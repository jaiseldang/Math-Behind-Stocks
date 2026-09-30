"use client";
import { line } from "d3";
import { useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Segmented, Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, sig, texNum } from "@/lib/format";
import { frontierVariance } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const RATIO_OPTIONS = ["It stays about the same", "It roughly doubles", "It more than triples"];

export function Frontier() {
  const { k, mvp, asym, stats, zeros } = useModel();
  const [target, setTarget] = useState(0.03);
  const [view, setView] = useState<"sigma" | "variance">("sigma");
  const sd = (m: number) => Math.sqrt(frontierVariance(k, m));
  const ratio = sd(0.04) / sd(0.02);
  const answer = ratio < 1.3 ? 0 : ratio < 2.7 ? 1 : 2;
  const mus = Array.from({ length: 161 }, (_, i) => -0.02 + i * 0.0005);
  // Local "exchange rate" dμ/dσ along the frontier: from σ² = (Aμ² − 2Bμ + C)/D, dσ/dμ = (Aμ − B)/(Dσ).
  const localSlope = (m: number) => (k.D * sd(m)) / (k.A * m - k.B);
  const numericSlope = (m: number, e = 1e-6) => (2 * e) / (sd(m + e) - sd(m - e));

  return (
    <>
      <GuessChoice id="explore-frontier" prompt="If you double your target from 2% to 4% a month, what happens to the minimum possible risk?" options={RATIO_OPTIONS} />
      <Intuition>
        <p>
          Near the safest portfolio, extra return is cheap: small shifts in the mix hardly change the risk (the bottom of a bowl is flat). Far away, you are
          betting heavily on the risky asset, so every extra 1% of return costs a fixed chunk of risk.
        </p>
        <p style={{ marginBottom: 0 }}>So the trade-off should start curved and then straighten out, like a hyperbola approaching its asymptotes.</p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "\\sigma^2 = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w = \\mathbf w^{\\mathsf T}\\cdot\\tfrac12(\\lambda_1\\mathbf 1 + \\lambda_2\\boldsymbol\\mu) = \\tfrac12(\\lambda_1 + \\lambda_2\\mu^*)", why: "Replace Σw using 2Σw = λ₁1 + λ₂μ, then use wᵀ1 = 1 and wᵀμ = μ*.", words: "Risk² simplifies using the two rules." },
          { tex: "\\sigma^2(\\mu^*) = \\frac{A\\mu^{*2} - 2B\\mu^* + C}{D}", why: "Substitute λ₁ and λ₂. This is a quadratic in μ*, so it is a parabola in the (μ*, σ²) plane.", words: "Risk² is a parabola in the target." },
          { tex: "\\frac{d\\sigma^2}{d\\mu^*} = \\frac{2A\\mu^* - 2B}{D} = 0 \\;\\Rightarrow\\; \\mu^* = \\frac BA,\\quad \\sigma^2 = \\frac1A", why: "The vertex by calculus: the global minimum-variance portfolio.", words: "The lowest point of the parabola is the safest portfolio of all." },
          { tex: `\\frac BA = ${texNum(k.B / k.A, 5)},\\qquad \\frac1{\\sqrt A} = ${texNum(1 / Math.sqrt(k.A), 5)}`, why: "With the IA data: the safest portfolio returns 1.78% a month with 2.37% risk.", words: "The actual numbers." },
          { tex: "\\left(\\mu^* - \\tfrac BA\\right)^2 = \\tfrac DA\\left(\\sigma^2 - \\tfrac1A\\right)", why: "Complete the square. In (σ, μ) this is a hyperbola.", words: "Rearranged, it is a hyperbola." },
          { tex: `\\mu = \\tfrac BA \\pm \\sqrt{\\tfrac DA}\\,\\sigma, \\qquad \\sqrt{\\tfrac DA} = ${texNum(asym.slope, 5)}`, why: "For large σ, the 1/A is negligible, leaving two straight lines: the asymptotes.", words: "Far out, the curve becomes two straight lines with slope √(D/A)." },
        ]}
      />
      <Experiment>
        <Segmented label="View" value={view} onChange={setView} options={[{ value: "sigma", label: "Risk σ vs return (hyperbola)" }, { value: "variance", label: "Return vs variance σ² (parabola)" }]} />
        <Slider label={<>Target <M>{"\\mu^*"}</M></>} value={target} min={-0.01} max={0.06} step={0.0005} onChange={setTarget} format={(v) => pct(v)} />
        <Figure
          title={view === "sigma" ? "The minimum-variance frontier and its asymptotes" : "Variance is a parabola in the target"}
          alt={`Frontier curve. Vertex at risk ${pct(mvp.sd)} and return ${pct(mvp.mu)}. Asymptote slope ${asym.slope.toFixed(4)}.`}
          table={{ header: ["μ*", "σ", "σ²"], rows: mus.filter((_, i) => i % 4 === 0).map((m) => [m, sd(m), frontierVariance(k, m)]) }}
          note={<Legend items={[{ label: "Frontier", color: "var(--c-frontier)" }, { label: "Asymptotes", color: "var(--c-neutral)", dashed: true }, { label: "No-short band", color: "var(--good)" }]} />}
        >
          {view === "sigma" ? (
            <Plot xDomain={[0, 0.14]} yDomain={[-0.02, 0.07]} xFormat={(v) => pct(v, 0)} yFormat={(v) => pct(v, 1)} xLabel="Risk σ (monthly)" yLabel="Target return μ*" zeroLineY>
              {({ x, y }) => {
                const gen = line<number>().x((m) => x(sd(m))).y((m) => y(m));
                return (
                  <>
                    {zeros.noShortInterval && (
                      <path d={gen(mus.filter((m) => m >= zeros.noShortInterval!.lower && m <= zeros.noShortInterval!.upper)) ?? ""} stroke="var(--good)" strokeWidth={8} opacity={0.3} fill="none" />
                    )}
                    {[asym.upper, asym.lower].map((f, i) => (
                      <line key={i} x1={x(0)} y1={y(f(0))} x2={x(0.14)} y2={y(f(0.14))} stroke="var(--c-neutral)" strokeDasharray="5 4" strokeWidth={1.5} />
                    ))}
                    <path d={gen(mus) ?? ""} stroke="var(--c-frontier)" strokeWidth={2.5} fill="none" />
                    {DEFAULT_ASSETS.map((a, i) => stats.sds[i] < 0.14 && (
                      <g key={a}>
                        <circle cx={x(stats.sds[i])} cy={y(stats.means[i])} r={6} fill={ASSETS[a].color} stroke="var(--surface)" strokeWidth={2} />
                        <text className="label" x={x(stats.sds[i]) + 9} y={y(stats.means[i])} dy="0.32em">{ASSETS[a].name}</text>
                      </g>
                    ))}
                    <text className="label" x={x(0.135)} y={y(0.035)} textAnchor="end" style={{ fontSize: 10.5 }}>Solana (σ {pct(stats.sds[2], 0)}) is off-chart →</text>
                    <circle cx={x(mvp.sd)} cy={y(mvp.mu)} r={5} fill="var(--c-frontier)" />
                    <text className="label" x={x(mvp.sd) - 8} y={y(mvp.mu) + 16} textAnchor="end">min. variance</text>
                    <circle cx={x(sd(target))} cy={y(target)} r={7} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />
                  </>
                );
              }}
            </Plot>
          ) : (
            <Plot xDomain={[-0.02, 0.06]} yDomain={[0, 0.02]} xFormat={(v) => pct(v, 0)} yFormat={(v) => sig(v, 2)} xLabel="Target return μ*" yLabel="Variance σ²">
              {({ x, y }) => (
                <>
                  <path d={line<number>().x((m) => x(m)).y((m) => y(frontierVariance(k, m)))(mus.filter((m) => frontierVariance(k, m) < 0.02)) ?? ""} stroke="var(--c-frontier)" strokeWidth={2.5} fill="none" />
                  <circle cx={x(mvp.mu)} cy={y(mvp.variance)} r={5} fill="var(--c-frontier)" />
                  <text className="label" x={x(mvp.mu)} y={y(mvp.variance) - 10} textAnchor="middle">vertex (B/A, 1/A)</text>
                  <circle cx={x(target)} cy={y(Math.min(0.02, frontierVariance(k, target)))} r={7} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />
                </>
              )}
            </Plot>
          )}
        </Figure>
        <div className="stats">
          <div className="stat"><div className="label">Minimum risk at {pct(target)}</div><div className="value">{pct(sd(target), 3)}</div></div>
          <div className="stat"><div className="label">Local exchange rate dμ/dσ</div><div className="value">{Math.abs(target - k.B / k.A) < 1e-9 ? "∞" : localSlope(target).toFixed(4)}</div><div className="sub">extra return per unit of extra risk here</div></div>
          <div className="stat"><div className="label">Far-away rate √(D/A)</div><div className="value">{asym.slope.toFixed(4)}</div><div className="sub">+1% return costs {pct(0.01 / asym.slope, 2)} risk</div></div>
        </div>
      </Experiment>
      <Finding
        headline={<>Risk grows faster than return: doubling the target from 2% to 4% multiplies the minimum risk by {ratio.toFixed(2)}. Far from the vertex each extra 1% of monthly return costs {pct(0.01 / asym.slope, 2)} of monthly risk.</>}
        guessId="explore-frontier"
        compare={(gs) => (gs.value === answer ? "Correct!" : `It ${RATIO_OPTIONS[answer].toLowerCase().replace("it ", "")}.`)}
      >
        <p>
          √(D/A) = {asym.slope.toFixed(5)} is the “exchange rate” between risk and return on the steep part of the frontier. Near the vertex the rate is much better
          (the local slope is larger), which is why the first bit of extra return is almost free.
        </p>
      </Finding>
      <Check>
        <p>Differentiate the frontier numerically (tiny step on either side) and compare with the formula dμ/dσ = Dσ/(Aμ* − B):</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>μ*</th><th>formula</th><th>numerical</th><th>√(D/A)</th></tr></thead>
            <tbody>
              {[0.02, 0.03, 0.05, 0.1, 0.3].map((m) => (
                <tr key={m}><td>{pct(m)}</td><td>{localSlope(m).toFixed(6)}</td><td>{numericSlope(m).toFixed(6)}</td><td>{asym.slope.toFixed(6)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">As μ* grows, the local rate approaches √(D/A), confirming the asymptote.</p>
      </Check>
    </>
  );
}
