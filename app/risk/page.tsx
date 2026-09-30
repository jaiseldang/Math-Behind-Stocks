"use client";
import { useState } from "react";
import { Figure } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { S } from "@/components/pattern/Tex";
import { useSettings } from "@/components/providers";
import { Segmented } from "@/components/ui/Slider";
import { WeightSliders } from "@/components/ui/WeightSliders";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, sig } from "@/lib/format";
import { portfolioVariance, regressionLine, sampleStdDev, sampleVariance, sumSquaredResiduals, varianceTerms } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const PAIRS = [
  { key: "0-1", i: 0, j: 1 },
  { key: "0-2", i: 0, j: 2 },
  { key: "1-2", i: 1, j: 2 },
] as const;
const RHO_OPTIONS = ["Strongly together (ρ > 0.5)", "Weakly together (0 < ρ < 0.5)", "Roughly unrelated, slightly opposite (−0.2 < ρ < 0)", "Strongly opposite (ρ < −0.5)"];

export default function RiskPage() {
  const { stats } = useModel();
  const { classmate } = useSettings();
  const [pairKey, setPairKey] = useState<"0-1" | "0-2" | "1-2">("0-1");
  const pair = PAIRS.find((p) => p.key === pairKey)!;
  const [w, setW] = useState([0.5, 0.5, 0]);

  const rho01 = stats.correlation[0][1];
  const rhoAnswer = rho01 > 0.5 ? 0 : rho01 > 0 ? 1 : rho01 > -0.5 ? 2 : 3;
  // own-risk terms first, then the cross terms (same order as the maths)
  const terms = varianceTerms(w, stats.Sigma).sort((a, b) => Number(a.i !== a.j) - Number(b.i !== b.j));
  const total = portfolioVariance(w, stats.Sigma);
  const portfolioSeries = stats.returns[0].map((_, t) => w.reduce((s, wi, i) => s + wi * stats.returns[i][t], 0));
  const crossSPXGold = terms.find((t) => t.i === 0 && t.j === 1)!.value;
  const nameOf = (i: number) => ASSETS[DEFAULT_ASSETS[i]].short;

  return (
    <>
      <PageHeader n={4} title="Risk & correlation" lead="Risk is not a property of each asset alone. It is a property of how they move together." />

      <Question>Why can mixing risky assets be <em>less</em> risky than any one of them?</Question>

      <GuessChoice id="risk-rho-spx-gold" prompt="In a month when the S&P 500 does well, what does gold tend to do? Pick the correlation you expect." options={RHO_OPTIONS} />

      <Intuition>
        <p>
          Two people sit on a see-saw. Each one moves up and down a lot, but the plank&apos;s middle stays still, because when one goes up the other goes down.
          That is a <strong>correlation</strong> of −1.
        </p>
        <p style={{ marginBottom: 0 }}>
          Real assets are never that perfect. But even a slight tendency to move oppositely, or just independently, cancels part of the swings.
        </p>
      </Intuition>

      <MathSteps
        steps={[
          { tex: "\\sigma_{ij} = \\frac{1}{n-1}\\sum_{t=1}^{n}(R_{i,t}-\\bar R_i)(R_{j,t}-\\bar R_j)", why: "Covariance: when both are above (or both below) average in the same month, the product is positive. Opposite moves give negative products.", words: "Covariance: do the two assets tend to be above average in the same months?" },
          { tex: "\\rho_{ij} = \\frac{\\sigma_{ij}}{\\sigma_i\\sigma_j} \\in [-1, 1]", why: "Dividing by both standard deviations removes the units, so correlations can be compared across pairs.", words: "Correlation = covariance scaled to lie between −1 and 1." },
          { tex: "\\operatorname{Var}(w_1R_1+w_2R_2) = w_1^2\\sigma_1^2 + w_2^2\\sigma_2^2 + 2w_1w_2\\sigma_{12}", why: "Expand (a + b)² inside the variance. The cross term 2ab becomes 2w₁w₂σ₁₂.", words: "Two-asset risk = each asset's own risk, plus a cross term for how they move together." },
          { tex: "\\sigma_p^2 = \\underbrace{w_1^2\\sigma_1^2 + w_2^2\\sigma_2^2 + w_3^2\\sigma_3^2}_{\\text{own risk}} + \\underbrace{2w_1w_2\\sigma_{12} + 2w_1w_3\\sigma_{13} + 2w_2w_3\\sigma_{23}}_{\\text{interaction}}", why: "With three assets, (a+b+c)² has 3 squares and 3 cross terms: six terms in total.", words: "Three assets: three own-risk terms and three interaction terms." },
          { tex: "\\sigma_{12} < 0 \\;\\Rightarrow\\; 2w_1w_2\\sigma_{12} < 0 \\quad (w_1, w_2 > 0)", why: "A negative covariance makes its term negative, so it subtracts from total risk. Even σ₁₂ = 0 helps: w² shrinks faster than w.", words: "If two assets move oppositely, holding both subtracts risk." },
        ]}
      />

      <Experiment title="Experiment A: draw the line yourself">
        <p>
          Each dot is one month. Drag the two <strong>round handles</strong> to draw the straight line that best fits the dots, then compare with the least-squares line.
        </p>
        <Segmented label="Pair" value={pairKey} onChange={(v) => setPairKey(v)} options={PAIRS.map((p) => ({ value: p.key, label: `${nameOf(p.i)} vs ${nameOf(p.j)}` }))} />
        <PairScatter key={pairKey} xs={stats.returns[pair.i]} ys={stats.returns[pair.j]} xi={pair.i} yi={pair.j} />
      </Experiment>

      <Experiment title="Experiment B: the six terms of risk">
        <p>Choose weights. Each bar is one term of <S tex="\sigma_p^2" words="portfolio variance" />. Bars below zero <em>reduce</em> risk.</p>
        <WeightSliders weights={w} onChange={setW} />
        <Figure
          title="Portfolio variance, term by term"
          alt={`Bar chart of the six variance terms. Total variance ${sig(total, 4)}, so risk ${pct(Math.sqrt(total))}. The S&P–gold term is ${sig(crossSPXGold, 3)}.`}
          table={{ header: ["Term", "Value"], rows: [...terms.map((t) => [t.i === t.j ? `w${t.i + 1}²σ${t.i + 1}²` : `2w${t.i + 1}w${t.j + 1}σ${t.i + 1}${t.j + 1}`, t.value]), ["Total", total]] }}
        >
          <TermBars terms={terms} total={total} classmate={classmate} nameOf={nameOf} />
        </Figure>
        <div className="stats">
          <div className="stat"><div className="label">Total variance</div><div className="value">{sig(total, 4)}</div></div>
          <div className="stat"><div className="label">Risk σ = √variance</div><div className="value">{pct(Math.sqrt(total))}</div></div>
          <div className="stat"><div className="label">Without the cross terms</div><div className="value">{pct(Math.sqrt(terms.filter((t) => t.i === t.j).reduce((s, t) => s + t.value, 0)))}</div></div>
        </div>
      </Experiment>

      <Finding
        headline={<>The S&amp;P 500 and gold have correlation {rho01.toFixed(3)}: slightly opposite, so their cross term is negative and <em>subtracts</em> risk.</>}
        guessId="risk-rho-spx-gold"
        compare={(g) => (g.value === rhoAnswer ? "Correct!" : `The actual correlation is ${rho01.toFixed(3)}, which is “${RHO_OPTIONS[rhoAnswer]}”.`)}
      >
        <p>
          Correlations: S&amp;P–gold {rho01.toFixed(3)}, S&amp;P–Solana {stats.correlation[0][2].toFixed(3)}, gold–Solana {stats.correlation[1][2].toFixed(3)}. Only the S&amp;P–gold
          pair moves (slightly) oppositely, which is why the low-risk portfolios are mostly S&amp;P 500 and gold.
        </p>
      </Finding>

      <Check>
        <p>Add the six bars, then compare with the variance of your portfolio&apos;s actual monthly returns:</p>
        <div className="stats">
          <div className="stat"><div className="label">Sum of the six terms</div><div className="value">{total.toExponential(6)}</div></div>
          <div className="stat"><div className="label">Variance of {portfolioSeries.length} portfolio returns</div><div className="value">{sampleVariance(portfolioSeries).toExponential(6)}</div></div>
        </div>
      </Check>
    </>
  );
}

function PairScatter({ xs, ys, xi, yi }: { xs: number[]; ys: number[]; xi: number; yi: number }) {
  const pad = (a: number[]) => {
    const lo = Math.min(...a);
    const hi = Math.max(...a);
    const p = (hi - lo) * 0.08;
    return [lo - p, hi + p] as [number, number];
  };
  const xd = pad(xs);
  const yd = pad(ys);
  const best = regressionLine(xs, ys);
  const mid = (yd[0] + yd[1]) / 2;
  const [handles, setHandles] = useState<[number, number]>([mid, mid]);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const [reveal, setReveal] = useState(false);
  const x0 = xd[0] + (xd[1] - xd[0]) * 0.08;
  const x1 = xd[1] - (xd[1] - xd[0]) * 0.08;
  const slope = (handles[1] - handles[0]) / (x1 - x0);
  const intercept = handles[0] - slope * x0;
  const mySSR = sumSquaredResiduals(xs, ys, intercept, slope);
  const bestSSR = sumSquaredResiduals(xs, ys, best.intercept, best.slope);
  const A = ASSETS[DEFAULT_ASSETS[xi]];
  const B = ASSETS[DEFAULT_ASSETS[yi]];
  const r = (best.slope * sampleStdDev(xs)) / sampleStdDev(ys); // ρ = b·s_x/s_y

  const nudge = (k: 0 | 1) => (e: React.KeyboardEvent) => {
    const step = (yd[1] - yd[0]) / 50;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = [...handles] as [number, number];
      next[k] += e.key === "ArrowUp" ? step : -step;
      setHandles(next);
    }
  };

  return (
    <Figure
      title={`${A.name} vs ${B.name}: monthly returns`}
      alt={`Scatter plot of ${xs.length} months. Correlation ${r.toFixed(3)}. Least-squares slope ${best.slope.toFixed(3)}.`}
      table={{ header: ["Month #", `${A.name} return`, `${B.name} return`], rows: xs.map((x, t) => [t + 1, x, ys[t]]) }}
      note={
        <>
          <div className="stats">
            <div className="stat"><div className="label">Your line: sum of squared errors</div><div className="value">{sig(mySSR, 4)}</div><div className="sub">slope {slope.toFixed(3)}</div></div>
            <div className="stat">
              <div className="label">Least squares (best possible)</div>
              <div className="value">{reveal ? sig(bestSSR, 4) : "?"}</div>
              <div className="sub">{reveal ? `slope ${best.slope.toFixed(3)}, ρ = ${r.toFixed(3)}` : "reveal when ready"}</div>
            </div>
            <div className="stat"><div className="label">How close are you?</div><div className="value">{reveal ? `${((bestSSR / mySSR) * 100).toFixed(0)}%` : "?"}</div><div className="sub">100% = perfect</div></div>
          </div>
          <button className="btn primary" onClick={() => setReveal(!reveal)}>{reveal ? "Hide" : "Reveal"} the least-squares line</button>
        </>
      }
    >
      <Plot
        xDomain={xd}
        yDomain={yd}
        xFormat={(v) => pct(v, 0)}
        yFormat={(v) => pct(v, 0)}
        xLabel={`${A.name} return`}
        yLabel={`${B.name} return`}
        zeroLineX
        zeroLineY
        onPointer={(d) => {
          if (drag === null) return;
          const next = [...handles] as [number, number];
          next[drag] = Math.max(yd[0], Math.min(yd[1], d.y));
          setHandles(next);
        }}
      >
        {({ x, y }) => (
          <>
            {xs.map((v, t) => (
              <circle key={t} cx={x(v)} cy={y(ys[t])} r={4.5} fill={B.color} fillOpacity={0.75} stroke="var(--surface)" strokeWidth={1} />
            ))}
            {reveal && (
              <line x1={x(xd[0])} x2={x(xd[1])} y1={y(best.intercept + best.slope * xd[0])} y2={y(best.intercept + best.slope * xd[1])} stroke="var(--c-frontier)" strokeWidth={2} strokeDasharray="6 4" />
            )}
            <line x1={x(xd[0])} x2={x(xd[1])} y1={y(intercept + slope * xd[0])} y2={y(intercept + slope * xd[1])} stroke="var(--c-you)" strokeWidth={2} />
            {([0, 1] as const).map((k) => (
              <circle
                key={k}
                cx={x(k === 0 ? x0 : x1)}
                cy={y(handles[k])}
                r={10}
                fill="var(--c-you)"
                stroke="var(--surface)"
                strokeWidth={3}
                tabIndex={0}
                role="slider"
                aria-label={`Line handle ${k + 1} (use up and down arrows)`}
                aria-valuenow={Number((handles[k] * 100).toFixed(1))}
                aria-valuetext={pct(handles[k], 1)}
                style={{ cursor: "ns-resize", touchAction: "none" }}
                onKeyDown={nudge(k)}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDrag(k);
                }}
                onPointerUp={() => setDrag(null)}
              />
            ))}
          </>
        )}
      </Plot>
    </Figure>
  );
}

function TermBars({ terms, total, classmate, nameOf }: { terms: { i: number; j: number; value: number }[]; total: number; classmate: boolean; nameOf: (i: number) => string }) {
  const vals = [...terms.map((t) => t.value), total];
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.1 || 1e-4;
  const labels = [
    ...terms.map((t) =>
      classmate ? (t.i === t.j ? `${nameOf(t.i)} own` : `${nameOf(t.i)}×${nameOf(t.j)}`) : t.i === t.j ? `w${t.i + 1}²σ${t.i + 1}²` : `2w${t.i + 1}w${t.j + 1}σ${t.i + 1}${t.j + 1}`,
    ),
    "Total",
  ];
  return (
    <Plot
      height={260}
      xDomain={[-0.5, 6.5]}
      yDomain={[lo - pad, hi + pad]}
      xTickValues={[0, 1, 2, 3, 4, 5, 6]}
      xFormat={(i) => labels[Math.round(i)] ?? ""}
      yFormat={(v) => sig(v, 2)}
      yLabel="Contribution to variance"
      zeroLineY
      margin={{ left: 70 }}
    >
      {({ x, y }) => {
        const bw = (x(1) - x(0)) * 0.6;
        return vals.map((v, k) => {
          const t = terms[k];
          const color = k === 6 ? "var(--ink-2)" : t.i === t.j ? ASSETS[DEFAULT_ASSETS[t.i]].color : v < 0 ? "var(--good)" : "var(--c-neutral)";
          return (
            <g key={k}>
              <rect x={x(k) - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3} fill={color} />
              <text className="label" x={x(k)} y={v >= 0 ? y(v) - 5 : y(v) + 13} textAnchor="middle" style={{ fontSize: 10 }}>{sig(v, 2)}</text>
            </g>
          );
        });
      }}
    </Plot>
  );
}

