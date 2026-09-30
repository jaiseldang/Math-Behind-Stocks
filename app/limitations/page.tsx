"use client";
import { line } from "d3";
import { useMemo, useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { TimeChart } from "@/components/charts/TimeChart";
import { Check, Experiment, Finding, GuessSlider, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct } from "@/lib/format";
import {
  analyseReturns, bootstrap, downsideDeviation, frontierVariance, lagrangeConstants, longOnlyOptimum,
  minimumVariancePortfolio, optimalWeights, quantile, zeroCrossings,
} from "@/lib/math";
import { useModel } from "@/lib/useModel";

const REPS = 400;

export default function LimitationsPage() {
  const { stats, k, zeros, returnMonths } = useModel();
  const n = stats.returns[0].length;
  const [win, setWin] = useState(18);

  // 1. Sample size: bootstrap the months.
  const boot = useMemo(
    () =>
      bootstrap(n, REPS, (idx) => {
        const s = analyseReturns(stats.returns.map((r) => idx.map((i) => r[i])));
        const kk = lagrangeConstants(s.Sigma, s.means);
        return { band: zeroCrossings(kk).noShortInterval, w2: optimalWeights(kk, 0.02).weights };
      }),
    [stats, n],
  );
  const withBand = boot.filter((b) => b.band);
  const bandShare = withBand.length / REPS;
  const lowers = withBand.map((b) => b.band!.lower);
  const uppers = withBand.map((b) => b.band!.upper);
  const wSpx = boot.map((b) => b.w2[0]);

  // 2. Stationarity: rolling windows.
  const rolling = useMemo(() => {
    const out: { month: string; w: number[] }[] = [];
    for (let end = win; end <= n; end++) {
      const s = analyseReturns(stats.returns.map((r) => r.slice(end - win, end)));
      out.push({ month: returnMonths[end - 1], w: minimumVariancePortfolio(lagrangeConstants(s.Sigma, s.means)).weights });
    }
    return out;
  }, [stats, n, win, returnMonths]);

  // 3. Short-selling: long-only frontier vs unconstrained.
  const mus = useMemo(() => {
    const lo = Math.min(...stats.means) + 1e-4;
    const hi = Math.max(...stats.means) - 1e-4;
    return Array.from({ length: 150 }, (_, i) => lo + ((hi - lo) * i) / 149);
  }, [stats]);
  const longOnly = mus.map((m) => ({ m, r: longOnlyOptimum(stats.Sigma, stats.means, m) }));

  // 4. Variance treats gains like losses.
  const downside = stats.returns.map(downsideDeviation);

  return (
    <>
      <PageHeader n={9} title="Limitations" lead="What the model assumes, and live demonstrations of how much each assumption matters." />

      <Question>How far can we trust the answer to the research question?</Question>

      <GuessSlider
        id="limits-bootstrap"
        prompt={`Imagine history had dealt a different ${n} months, drawn at random (with repeats) from the same ones we have. In what share of such alternative histories would a no-short-selling band exist at all?`}
        min={0}
        max={1}
        step={0.01}
        initial={0.5}
        format={(v) => pct(v, 0)}
      />

      <Intuition>
        <p>
          A model is a map, not the territory. The Markowitz method is exact <em>given</em> its inputs, but the inputs are estimates from a short, unusual period, and the
          model makes simplifying assumptions about what “risk” means and what investors are allowed to do.
        </p>
      </Intuition>

      <MathSteps
        steps={[
          { tex: "\\hat{\\boldsymbol\\mu},\\ \\hat\\Sigma \\text{ estimated from } n = 36 \\text{ months} \\;\\Rightarrow\\; \\operatorname{SE}(\\hat\\mu_i) = \\frac{s_i}{\\sqrt{n}}", why: "Sample size: every input carries sampling error, and the weights depend on Σ⁻¹, which can magnify it.", words: "Our inputs are estimates from only 36 months." },
          { tex: "\\boldsymbol\\mu_t = \\boldsymbol\\mu, \\quad \\Sigma_t = \\Sigma \\quad \\text{for all } t", why: "Stationarity: the model assumes the means and covariances never change. Crypto markets in particular change character quickly.", words: "The model assumes the future behaves like the past." },
          { tex: "\\min\\ \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w \\;\\text{ s.t. }\\; \\mathbf 1^{\\mathsf T}\\mathbf w = 1,\\ \\boldsymbol\\mu^{\\mathsf T}\\mathbf w = \\mu^*,\\ \\mathbf w \\ge \\mathbf 0", why: "Banning short-selling adds inequality constraints. Lagrange multipliers only handle equalities.", words: "Forbidding negative weights adds “greater than or equal” rules." },
          { tex: "2\\Sigma\\mathbf w = \\lambda_1\\mathbf 1 + \\lambda_2\\boldsymbol\\mu + \\boldsymbol\\nu, \\quad \\nu_i \\ge 0, \\quad \\nu_i w_i = 0", why: "The Karush–Kuhn–Tucker (KKT) conditions: an extra multiplier νᵢ ≥ 0 per asset, which can only be non-zero when that weight is exactly 0 (complementary slackness).", words: "Each asset gets its own extra helper number, which only switches on when that asset's weight is stuck at zero." },
          { tex: "\\sigma^2 = \\mathbb E\\big[(R-\\mu)^2\\big] \\quad\\text{vs}\\quad \\sigma_-^2 = \\mathbb E\\big[\\min(R-\\mu, 0)^2\\big]", why: "Variance penalises pleasant surprises as much as unpleasant ones. Downside deviation only counts the bad months.", words: "Variance counts big gains as “risk” too." },
        ]}
      />

      <Experiment title="Demo 1: sample size (bootstrap)">
        <p>
          The computer builds {REPS} alternative histories by drawing {n} months at random (with repeats) from the real ones, then re-solves the whole problem for each.
        </p>
        <div className="stats">
          <div className="stat"><div className="label">Histories with a no-short band</div><div className="value">{pct(bandShare, 0)}</div></div>
          <div className="stat"><div className="label">Lower edge, 90% range</div><div className="value" style={{ fontSize: "1.05rem" }}>{lowers.length ? `${pct(quantile(lowers, 0.05))} – ${pct(quantile(lowers, 0.95))}` : "—"}</div><div className="sub">IA: {zeros.noShortInterval ? pct(zeros.noShortInterval.lower, 3) : "—"}</div></div>
          <div className="stat"><div className="label">Upper edge, 90% range</div><div className="value" style={{ fontSize: "1.05rem" }}>{uppers.length ? `${pct(quantile(uppers, 0.05))} – ${pct(quantile(uppers, 0.95))}` : "—"}</div><div className="sub">IA: {zeros.noShortInterval ? pct(zeros.noShortInterval.upper, 3) : "—"}</div></div>
          <div className="stat"><div className="label">S&amp;P weight at 2%, 90% range</div><div className="value" style={{ fontSize: "1.05rem" }}>{pct(quantile(wSpx, 0.05), 0)} – {pct(quantile(wSpx, 0.95), 0)}</div><div className="sub">IA: {pct(optimalWeights(k, 0.02).weights[0], 1)}</div></div>
        </div>
        <Figure
          title="Where the no-short band's edges land across alternative histories"
          caption={`Bootstrap: ${REPS} resamples of the ${n} monthly returns in the current dataset (seed 42).`}
          alt="Histograms of the lower and upper edges of the no-short-selling band across bootstrap samples; both are widely spread."
          table={{ header: ["Resample", "lower edge", "upper edge"], rows: withBand.map((b, i) => [i + 1, b.band!.lower, b.band!.upper]) }}
          note={<Legend items={[{ label: "Lower edge", color: ASSETS.SOL.color }, { label: "Upper edge", color: ASSETS.SPX.color }]} />}
        >
          <Histogram series={[{ values: lowers, color: ASSETS.SOL.color }, { values: uppers, color: ASSETS.SPX.color }]} domain={[0, 0.07]} marks={zeros.noShortInterval ? [zeros.noShortInterval.lower, zeros.noShortInterval.upper] : []} />
        </Figure>
      </Experiment>

      <Experiment title="Demo 2: stationarity (rolling windows)">
        <p>Re-solve the minimum-variance portfolio using only the most recent months at each point in time.</p>
        <Slider label="Window length (months)" value={win} min={12} max={30} step={1} onChange={setWin} format={(v) => String(v)} />
        <Figure
          title={`Minimum-variance weights from rolling ${win}-month windows`}
          alt="Rolling minimum-variance weights change noticeably over time, especially the split between S&P 500 and gold."
          table={{ header: ["Window ending", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: rolling.map((r) => [r.month, ...r.w]) }}
          note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
        >
          <TimeChart months={rolling.map((r) => r.month)} zeroLine yFormat={(v) => pct(v, 0)} yLabel="Weight" series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: rolling.map((r) => r.w[i]) }))} />
        </Figure>
      </Experiment>

      <Experiment title="Demo 3: banning short-selling (KKT)">
        <p>
          Outside the no-short band, the Lagrange answer needs a short position. If shorts are banned, the best you can do (found numerically) is shown in orange. Inside the band the
          two curves coincide.
        </p>
        <Figure
          title="Minimum risk with and without short-selling"
          alt="The long-only frontier lies on or to the right of the unconstrained frontier and matches it only inside the no-short band."
          table={{ header: ["μ*", "σ unconstrained", "σ long-only"], rows: longOnly.filter((_, i) => i % 5 === 0).map(({ m, r }) => [m, Math.sqrt(frontierVariance(k, m)), r ? Math.sqrt(r.variance) : ""]) }}
          note={<Legend items={[{ label: "Short-selling allowed", color: "var(--c-frontier)" }, { label: "No short-selling", color: "var(--c-xau)" }]} />}
        >
          <Plot xDomain={[0, 0.28]} yDomain={[0.01, 0.07]} xFormat={(v) => pct(v, 0)} yFormat={(v) => pct(v, 1)} xLabel="Risk σ" yLabel="Target return μ*">
            {({ x, y }) => (
              <>
                {zeros.noShortInterval && (
                  <rect x={0} width={x(0.28)} y={y(zeros.noShortInterval.upper)} height={y(zeros.noShortInterval.lower) - y(zeros.noShortInterval.upper)} fill="var(--good)" opacity={0.1} />
                )}
                <path d={line<number>().x((m) => x(Math.sqrt(frontierVariance(k, m)))).y((m) => y(m))(mus) ?? ""} stroke="var(--c-frontier)" strokeWidth={2.5} fill="none" />
                <path d={line<{ m: number; r: ReturnType<typeof longOnlyOptimum> }>().defined((d) => d.r !== null).x((d) => x(Math.sqrt(d.r!.variance))).y((d) => y(d.m))(longOnly) ?? ""} stroke="var(--c-xau)" strokeWidth={2} strokeDasharray="6 3" fill="none" />
                {DEFAULT_ASSETS.map((a, i) => (
                  <g key={a}>
                    <circle cx={x(stats.sds[i])} cy={y(stats.means[i])} r={6} fill={ASSETS[a].color} stroke="var(--surface)" strokeWidth={2} />
                    <text className="label" x={x(stats.sds[i]) - 9} y={y(stats.means[i])} dy="0.32em" textAnchor="end">{ASSETS[a].name}</text>
                  </g>
                ))}
              </>
            )}
          </Plot>
        </Figure>
      </Experiment>

      <Experiment title="Demo 4: variance treats gains like losses">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Asset</th><th>σ</th><th>Downside deviation σ₋</th><th>σ₋ / σ</th><th>Best month</th><th>Worst month</th></tr></thead>
            <tbody>
              {DEFAULT_ASSETS.map((a, i) => (
                <tr key={a}>
                  <td><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}</td>
                  <td>{pct(stats.sds[i])}</td><td>{pct(downside[i])}</td><td>{(downside[i] / stats.sds[i]).toFixed(2)}</td>
                  <td className="pos">{pct(Math.max(...stats.returns[i]), 1)}</td><td className="neg">{pct(Math.min(...stats.returns[i]), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          For a symmetric distribution σ₋/σ ≈ 0.71. Solana&apos;s ratio is lower: a lot of its “risk” is huge <em>gains</em> (up to {pct(Math.max(...stats.returns[2]), 0)} in one month),
          which variance counts as bad.
        </p>
      </Experiment>

      <Experiment title="Demo 5: data choices">
        <ul>
          <li><a href="/data">Monthly averages vs month-end closes</a>: averaging lowers measured risk by about 18% and adds autocorrelation.</li>
          <li><a href="/explore#investigation-5">The time window</a>: dropping 6 months noticeably moves the no-short band.</li>
          <li>Solana is resampled from weekly candles, the S&amp;P 500 from trading days, and gold is a published monthly average: three different kinds of “monthly price”.</li>
          <li>Transaction costs, taxes, the cost of borrowing to short, and exchange risk are all ignored.</li>
        </ul>
      </Experiment>

      <Finding
        headline={
          <>
            The method is exact, but its inputs are noisy: a no-short band exists in {pct(bandShare, 0)} of alternative histories, yet its edges wander
            {lowers.length ? ` (lower ${pct(quantile(lowers, 0.05), 1)}–${pct(quantile(lowers, 0.95), 1)}, upper ${pct(quantile(uppers, 0.05), 1)}–${pct(quantile(uppers, 0.95), 1)})` : ""} by whole percentage points.
          </>
        }
        guessId="limits-bootstrap"
        compare={(g) => `The share was ${pct(bandShare, 0)}; you were ${pct(Math.abs(Number(g.value) - bandShare), 0)} ${Number(g.value) > bandShare ? "too high" : "too low"}.`}
      >
        <p>
          The IA&apos;s band ({zeros.noShortInterval ? `${pct(zeros.noShortInterval.lower, 2)}–${pct(zeros.noShortInterval.upper, 2)}` : "—"}) is best reported as a property of <em>this sample</em>, not
          a law of markets, with the bootstrap ranges above as a measure of its uncertainty.
        </p>
      </Finding>

      <Check>
        <p>
          The long-only curve is a check on itself: inside the band it must equal the Lagrange answer, and outside it one weight must be exactly 0 (complementary slackness). At μ* = 2.2%
          the long-only weights are ({longOnlyOptimum(stats.Sigma, stats.means, 0.022)?.weights.map((w) => w.toFixed(5)).join(", ")}) vs Lagrange ({optimalWeights(k, 0.022).weights.map((w) => w.toFixed(5)).join(", ")}).
          At μ* = 1.7%: long-only ({longOnlyOptimum(stats.Sigma, stats.means, 0.017)?.weights.map((w) => w.toFixed(4)).join(", ")}): Solana is pinned at 0.
        </p>
      </Check>
    </>
  );
}

function Histogram({ series, domain, marks }: { series: { values: number[]; color: string }[]; domain: [number, number]; marks: number[] }) {
  const bins = 35;
  const width = (domain[1] - domain[0]) / bins;
  const counts = series.map((s) => {
    const c = new Array(bins).fill(0);
    for (const v of s.values) {
      const b = Math.floor((v - domain[0]) / width);
      if (b >= 0 && b < bins) c[b]++;
    }
    return c;
  });
  const max = Math.max(1, ...counts.flat());
  return (
    <Plot height={220} xDomain={domain} yDomain={[0, max * 1.1]} xFormat={(v) => pct(v, 0)} yFormat={(v) => String(Math.round(v))} xLabel="Target return at the band edge" yLabel="Resamples">
      {({ x, y }) => (
        <>
          {counts.map((c, s) =>
            c.map((v, b) => v > 0 && (
              <rect key={`${s}-${b}`} x={x(domain[0] + b * width) + 1 + s * ((x(width) - x(0)) / 2 - 1)} width={Math.max(1, (x(width) - x(0)) / 2 - 2)} y={y(v)} height={y(0) - y(v)} rx={2} fill={series[s].color} />
            )),
          )}
          {marks.map((m) => (
            <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={y(0)} stroke="var(--ink)" strokeDasharray="4 3" />
          ))}
        </>
      )}
    </Plot>
  );
}
