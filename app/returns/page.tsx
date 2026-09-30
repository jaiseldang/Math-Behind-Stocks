"use client";
import { line } from "d3";
import { useMemo, useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { TimeChart } from "@/components/charts/TimeChart";
import { Check, Experiment, Finding, GuessSlider, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Segmented, Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, usd } from "@/lib/format";
import { geometricMean, mean, sampleStdDev, simulateReturns } from "@/lib/math";
import { useModel } from "@/lib/useModel";

export default function ReturnsPage() {
  const { months, returnMonths, prices, stats } = useModel();
  const [view, setView] = useState<"prices" | "returns">("returns");
  const [mu, setMu] = useState(0.02);
  const [sigma, setSigma] = useState(0.1);
  const [n, setN] = useState(120);
  const [seed, setSeed] = useState(1);

  const sim = useMemo(() => simulateReturns(mu, sigma, n, seed), [mu, sigma, n, seed]);
  const simAM = mean(sim);
  const simGM = geometricMean(sim);
  const simSD = sampleStdDev(sim);
  const path = useMemo(() => sim.reduce<number[]>((acc, r) => [...acc, acc[acc.length - 1] * (1 + r)], [100]), [sim]);

  // Gap AM − GM against σ, from long simulations (so sampling noise is small), vs the σ²/2 approximation.
  const curve = useMemo(() => {
    const out: { s: number; gap: number; approx: number }[] = [];
    for (let s = 0; s <= 0.5001; s += 0.025) {
      const r = simulateReturns(mu, s, 20000, 99);
      out.push({ s, gap: mean(r) - geometricMean(r), approx: (s * s) / 2 });
    }
    return out;
  }, [mu]);
  const breakAt = curve.find((c) => c.s > 0 && Math.abs(c.approx - c.gap) / c.gap > 0.1);

  const sol = 2;
  const solRatio = prices[sol].at(-1)! / prices[sol][0];
  const nRet = stats.returns[0].length;

  return (
    <>
      <PageHeader n={3} title="Returns" lead="Why we analyse percentage changes, and why “the average return” can mislead." />

      <Question>
        Solana&apos;s average monthly return in the data is {pct(stats.means[sol])}. Did someone who bought and held Solana really earn {pct(stats.means[sol])} a month?
      </Question>

      <GuessSlider
        id="returns-sol-growth"
        prompt="Guess the steady monthly growth rate that would have turned the starting Solana price into the final one."
        min={0}
        max={0.08}
        step={0.0025}
        initial={0.065}
        format={(v) => pct(v)}
      />

      <Intuition>
        <p>Gain 50%, then lose 50%. The average of +50% and −50% is 0%, yet $100 → $150 → $75. You are <strong>down 25%</strong>.</p>
        <p style={{ marginBottom: 0 }}>
          Losses hurt more than equal-sized gains help, because the loss is taken from a bigger pile. The wilder the swings, the bigger this
          <strong> volatility drag</strong>. Solana swings wildly.
        </p>
      </Intuition>

      <MathSteps
        steps={[
          { tex: "R_t = \\frac{P_t}{P_{t-1}} - 1", why: <>Returns have no units, so a $22 coin and a 4,457-point index can be compared fairly. Prices can&apos;t be.</>, words: "Return = this month's price ÷ last month's price, minus 1." },
          { tex: "\\bar R = \\frac1n\\sum_{t=1}^n R_t", why: "The arithmetic mean (AM): what the model uses as the expected return μ.", words: "Arithmetic mean = add the returns and divide by how many." },
          { tex: "(1+G)^n = \\prod_{t=1}^n (1+R_t) = \\frac{P_1}{P_0}\\cdot\\frac{P_2}{P_1}\\cdots\\frac{P_n}{P_{n-1}} = \\frac{P_n}{P_0}", why: "The geometric mean G is the constant rate that gives the same total growth. The product telescopes: every middle price cancels.", words: "Geometric mean = the steady growth rate that turns the first price into the last." },
          { tex: "\\ln(1+G) = \\frac1n\\sum_{t=1}^n \\ln(1+R_t)", why: "Take logs: a product becomes a sum, so the log of (1+G) is an ordinary average.", words: "Taking logs turns multiplying into adding." },
          { tex: "\\ln(1+R) = R - \\tfrac{R^2}{2} + \\tfrac{R^3}{3} - \\cdots \\approx R - \\tfrac{R^2}{2}", why: "Maclaurin series of ln(1+x), valid for |x| < 1. We keep terms up to R², which is accurate only when R is small.", words: "For small returns, ln(1 + R) is about R minus half of R squared." },
          { tex: "G - \\tfrac{G^2}{2} \\approx \\bar R - \\tfrac12\\left(\\sigma^2 + \\bar R^2\\right)", why: "Average both sides. The mean of R² is σ² + R̄² (the variance identity, with n−1 ≈ n).", words: "Averaging both sides brings in the variance." },
          { tex: "\\boxed{\\;G \\approx \\bar R - \\tfrac{\\sigma^2}{2}\\;}", why: "Since G ≈ R̄, the G²/2 and R̄²/2 terms (almost) cancel. So the drag AM − GM is about half the variance.", words: "Geometric mean ≈ arithmetic mean minus half the variance." },
        ]}
      />

      <Experiment title="Experiment A: prices vs returns">
        <Segmented label="Show" value={view} onChange={setView} options={[{ value: "returns", label: "Monthly returns" }, { value: "prices", label: "Prices (indexed to 100)" }]} />
        <Figure
          title={view === "returns" ? "Monthly simple returns" : "Prices, indexed to 100 in the first month"}
          alt={view === "returns" ? "Monthly returns for each asset. Solana's swing between about −40% and +110%; the others stay within ±10%." : "Indexed prices for each asset."}
          table={
            view === "returns"
              ? { header: ["Month", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: returnMonths.map((m, t) => [m, ...stats.returns.map((r) => r[t])]) }
              : { header: ["Month", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: months.map((m, t) => [m, ...prices.map((p) => p[t])]) }
          }
          note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
        >
          {view === "returns" ? (
            <TimeChart months={returnMonths} zeroLine yFormat={(v) => pct(v, 0)} yLabel="Return in month" series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: stats.returns[i] }))} />
          ) : (
            <TimeChart months={months} yLog yFormat={(v) => String(Math.round(v))} yLabel="Index (log scale)" series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: prices[i].map((v) => (100 * v) / prices[i][0]) }))} />
          )}
        </Figure>
      </Experiment>

      <Experiment title="Experiment B: the volatility-drag simulator">
        <p>Random monthly returns with a chosen average and spread. Raise σ and watch the gap between AM and GM grow.</p>
        <Slider label={<>Average μ</>} value={mu} min={0} max={0.08} step={0.005} onChange={setMu} format={(v) => pct(v, 1)} />
        <Slider label={<>Spread σ</>} value={sigma} min={0} max={0.5} step={0.01} onChange={setSigma} format={(v) => pct(v, 0)} />
        <Slider label="Months" value={n} min={12} max={600} step={12} onChange={setN} format={(v) => String(v)} />
        <div className="btn-row"><button className="btn" onClick={() => setSeed(seed + 1)}>New random path</button></div>
        <div className="stats">
          <div className="stat"><div className="label">AM (sample)</div><div className="value">{pct(simAM)}</div></div>
          <div className="stat"><div className="label">GM (sample)</div><div className="value">{pct(simGM)}</div></div>
          <div className="stat"><div className="label">Gap AM − GM</div><div className="value">{pct(simAM - simGM)}</div></div>
          <div className="stat"><div className="label">σ²/2 (sample σ)</div><div className="value">{pct((simSD * simSD) / 2)}</div></div>
          <div className="stat"><div className="label">$100 becomes</div><div className="value">{usd(path.at(-1)!, 0)}</div><div className="sub">after {n} months</div></div>
        </div>
        <Figure
          title="How big is the drag? Simulated gap vs the σ²/2 rule"
          caption={`Simulated: 20,000 normally distributed monthly returns per point, mean ${pct(mu, 1)}. Not market data.`}
          alt="The simulated AM−GM gap rises with σ, closely following σ²/2 at first, then falling below it for large σ."
          table={{ header: ["σ", "Simulated AM − GM", "σ²/2"], rows: curve.map((c) => [c.s, c.gap, c.approx]) }}
          note={
            <>
              <Legend items={[{ label: "Simulated gap", color: "var(--c-frontier)" }, { label: "σ²/2 approximation", color: "var(--c-neutral)", dashed: true }, { label: "Solana (real)", color: ASSETS.SOL.color }]} />
              {breakAt && <p className="note">The approximation is more than 10% off from about σ = {pct(breakAt.s, 1)}. Solana&apos;s σ is {pct(stats.sds[sol], 1)}.</p>}
            </>
          }
        >
          <Plot xDomain={[0, 0.5]} yDomain={[0, Math.max(...curve.map((c) => Math.max(c.gap, c.approx))) * 1.05]} xFormat={(v) => pct(v, 0)} yFormat={(v) => pct(v, 0)} xLabel="σ (monthly)" yLabel="AM − GM">
            {({ x, y }) => {
              const g = line<{ s: number; v: number }>().x((d) => x(d.s)).y((d) => y(d.v));
              const cs = Math.min(stats.sds[sol], 0.5);
              return (
                <>
                  <path d={g(curve.map((c) => ({ s: c.s, v: c.approx }))) ?? ""} stroke="var(--c-neutral)" strokeDasharray="5 4" strokeWidth={2} fill="none" />
                  <path d={g(curve.map((c) => ({ s: c.s, v: c.gap }))) ?? ""} stroke="var(--c-frontier)" strokeWidth={2} fill="none" />
                  <circle cx={x(sigma)} cy={y((sigma * sigma) / 2)} r={4} fill="var(--c-you)" />
                  <circle cx={x(cs)} cy={y(stats.means[sol] - stats.geometricMeans[sol])} r={6} fill={ASSETS.SOL.color} stroke="var(--surface)" strokeWidth={2} />
                  <text className="label" x={x(cs) - 8} y={y(stats.means[sol] - stats.geometricMeans[sol])} dy="-0.7em" textAnchor="end">Solana</text>
                </>
              );
            }}
          </Plot>
        </Figure>
      </Experiment>

      <Experiment title="Experiment C: the real assets">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Asset</th><th>AM</th><th>GM</th><th>AM − GM</th><th>σ²/2</th><th>Error of σ²/2</th></tr></thead>
            <tbody>
              {DEFAULT_ASSETS.map((a, i) => {
                const gap = stats.means[i] - stats.geometricMeans[i];
                const approx = stats.variances[i] / 2;
                return (
                  <tr key={a}>
                    <td><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}</td>
                    <td>{pct(stats.means[i], 3)}</td><td>{pct(stats.geometricMeans[i], 3)}</td><td>{pct(gap, 3)}</td><td>{pct(approx, 3)}</td>
                    <td>{pct((approx - gap) / gap, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note">
          For the S&amp;P 500 and gold, the rule is close. For Solana it overstates the drag, because returns like +110% are far too big for the R² approximation (the
          <M>{"R^3/3"}</M> term matters).
        </p>
      </Experiment>

      <Finding
        headline={<>A Solana holder actually grew at {pct(stats.geometricMeans[sol])} a month, not {pct(stats.means[sol])}: volatility drag ate {pct(stats.means[sol] - stats.geometricMeans[sol])} a month.</>}
        guessId="returns-sol-growth"
        compare={(g) => {
          const d = Number(g.value) - stats.geometricMeans[sol];
          return Math.abs(d) < 0.005 ? "Very close!" : `You were ${pct(Math.abs(d))} ${d > 0 ? "too high" : "too low"}.`;
        }}
      >
        <p>
          The arithmetic mean is still the right input for Markowitz: it is the <em>expected</em> return of next month. But the <a href="/explore#investigation-6">sixth investigation</a> asks what this means for the
          model&apos;s promises.
        </p>
      </Finding>

      <Check>
        <p>
          The telescoping step says <M>{"(1+G)^n = P_n/P_0"}</M>. For Solana: <M>{`(1 + ${stats.geometricMeans[sol].toFixed(6)})^{${nRet}} = ${Math.pow(1 + stats.geometricMeans[sol], nRet).toFixed(6)}`}</M>, and{" "}
          <M>{`${prices[sol].at(-1)} / ${prices[sol][0]} = ${solRatio.toFixed(6)}`}</M>. They match, so the geometric mean really is the buy-and-hold growth rate.
        </p>
      </Check>
    </>
  );
}
