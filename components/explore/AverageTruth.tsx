"use client";
import { line } from "d3";
import { useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, GuessSlider, Intuition, MathSteps } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, texNum } from "@/lib/format";
import { frontierVariance, geometricMean, mean, optimalWeights } from "@/lib/math";
import { useModel } from "@/lib/useModel";

export function AverageTruth() {
  const { k, stats } = useModel();
  const [target, setTarget] = useState(0.02);
  const approxG = (m: number) => m - frontierVariance(k, m) / 2;
  // In-sample: hold the optimal weights every month (rebalancing monthly) and compound the actual returns.
  const realised = (m: number) => {
    const w = optimalWeights(k, m).weights;
    const r = stats.returns[0].map((_, t) => w.reduce((s, wi, i) => s + wi * stats.returns[i][t], 0));
    return { am: mean(r), gm: geometricMean(r) };
  };
  const peak = (k.B + k.D) / k.A;
  const mus = Array.from({ length: 121 }, (_, i) => 0 + i * 0.001);
  const cur = realised(target);
  const at2 = realised(0.02);

  return (
    <>
      <GuessSlider
        id="explore-gm"
        prompt="The model's 2%-a-month portfolio, held (and rebalanced monthly) through the 36 months of data: what steady monthly growth did it actually achieve?"
        min={0.01}
        max={0.025}
        step={0.0005}
        initial={0.015}
        format={(v) => pct(v, 2)}
      />
      <Intuition>
        <p>
          On page 3, Solana&apos;s wild swings dragged its real growth far below its average return. Low-risk portfolios swing much less, so the drag should be small.
          But if you keep raising the target, you also raise the swings, and at some point the drag should overtake the gain.
        </p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "G_p \\approx \\mu_p - \\tfrac12\\sigma_p^2", why: "The volatility-drag rule from page 3, applied to the whole portfolio.", words: "Real growth ≈ average return − half the variance." },
          { tex: "G(\\mu^*) \\approx \\mu^* - \\frac{A\\mu^{*2} - 2B\\mu^* + C}{2D}", why: "On the frontier, σ² is the parabola from investigation 3.", words: "Along the frontier, real growth is a downward parabola in the target." },
          { tex: "\\frac{dG}{d\\mu^*} = 1 - \\frac{A\\mu^* - B}{D} = 0 \\;\\Rightarrow\\; \\mu^* = \\frac{B + D}{A}", why: "Set the derivative to zero to find the target with the highest long-run growth.", words: "There's a target that maximises real growth." },
          { tex: `\\frac{B+D}{A} = ${texNum(peak, 4)}`, why: "With the IA data: far beyond anything sensible (it needs huge short positions). Below it, a higher target still raises long-run growth, just less than the average suggests.", words: "The actual number." },
        ]}
      />
      <Experiment>
        <Slider label={<>Target <M>{"\\mu^*"}</M></>} value={target} min={0} max={0.12} step={0.0005} onChange={setTarget} format={(v) => pct(v)} />
        <div className="stats">
          <div className="stat"><div className="label">Promised (arithmetic)</div><div className="value">{pct(target)}</div></div>
          <div className="stat"><div className="label">Approx. growth μ* − σ²/2</div><div className="value">{pct(approxG(target))}</div></div>
          <div className="stat"><div className="label">Actual in-sample growth</div><div className="value">{cur.gm <= -1 ? "wiped out" : pct(cur.gm)}</div><div className="sub">weights held for 36 months</div></div>
        </div>
        <Figure
          title="Promised average vs real compound growth along the frontier"
          alt={`The promised return rises in a straight line; the approximate compound growth curves over and peaks at a target of ${pct(peak, 1)}.`}
          table={{ header: ["μ*", "approx. G", "in-sample G"], rows: mus.filter((_, i) => i % 5 === 0).map((m) => [m, approxG(m), realised(m).gm]) }}
          note={<Legend items={[{ label: "Promised μ*", color: "var(--c-neutral)", dashed: true }, { label: "μ* − σ²/2", color: "var(--c-frontier)" }, { label: "Actual (in-sample)", color: "var(--c-xau)" }]} />}
        >
          <Plot xDomain={[0, 0.12]} yDomain={[-0.02, 0.12]} xFormat={(v) => pct(v, 0)} yFormat={(v) => pct(v, 0)} xLabel="Target μ*" yLabel="Monthly growth" zeroLineY>
            {({ x, y }) => {
              const gen = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
              return (
                <>
                  <path d={gen(mus.map((m) => [m, m])) ?? ""} stroke="var(--c-neutral)" strokeDasharray="5 4" strokeWidth={1.5} fill="none" />
                  <path d={gen(mus.map((m) => [m, approxG(m)])) ?? ""} stroke="var(--c-frontier)" strokeWidth={2.5} fill="none" />
                  <path d={gen(mus.map((m) => [m, Math.max(-0.02, realised(m).gm)])) ?? ""} stroke="var(--c-xau)" strokeWidth={2} fill="none" />
                  <circle cx={x(target)} cy={y(approxG(target))} r={6} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />
                </>
              );
            }}
          </Plot>
        </Figure>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Asset</th><th>AM</th><th>GM</th><th>GM / AM</th></tr></thead>
            <tbody>
              {DEFAULT_ASSETS.map((a, i) => (
                <tr key={a}><td>{ASSETS[a].name}</td><td>{pct(stats.means[i])}</td><td>{pct(stats.geometricMeans[i])}</td><td>{pct(stats.geometricMeans[i] / stats.means[i], 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Experiment>
      <Finding
        headline={<>For the 2% portfolio the average tells the truth: it actually grew {pct(at2.gm, 3)} a month. But the gap widens quadratically, and past μ* ≈ {pct(peak, 1)} a higher “average” target means <em>lower</em> real growth.</>}
        guessId="explore-gm"
        compare={(g) => `The in-sample figure is ${pct(at2.gm, 3)}; you were ${pct(Math.abs(Number(g.value) - at2.gm), 2)} ${Number(g.value) > at2.gm ? "too high" : "too low"}.`}
      >
        <p>
          The model uses the arithmetic mean because it optimises one month at a time. That is fine for the low-risk portfolios in the no-short band, but for Solana on its own the
          arithmetic mean ({pct(stats.means[2])}) greatly overstates what a holder earned ({pct(stats.geometricMeans[2])}).
        </p>
      </Finding>
      <Check>
        <p>
          At 2%: approximation μ* − σ²/2 = {pct(approxG(0.02), 4)}; actual in-sample compound growth = {pct(at2.gm, 4)}; in-sample average return = {pct(at2.am, 4)} (equal to the target by construction).
        </p>
      </Check>
    </>
  );
}
