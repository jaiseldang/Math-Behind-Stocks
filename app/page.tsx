"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { RiskReturnMap } from "@/components/charts/RiskReturnMap";
import { TimeChart } from "@/components/charts/TimeChart";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Segmented } from "@/components/ui/Slider";
import { TradingViewMini } from "@/components/ui/TradingView";
import { WeightSliders } from "@/components/ui/WeightSliders";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, usd } from "@/lib/format";
import { dot, gridMinimum, portfolioVariance, sampleStdDev, simplexGrid } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const AMOUNT = 1000;
const OPTIONS = [
  { label: "All $1,000 in the S&P 500", w: [1, 0, 0] },
  { label: "All $1,000 in gold", w: [0, 1, 0] },
  { label: "$500 S&P 500 + $500 gold", w: [0.5, 0.5, 0] },
  { label: "$333 in each of the three", w: [1 / 3, 1 / 3, 1 / 3] },
];

export default function Home() {
  const { months, prices, stats } = useModel();
  const [w, setW] = useState([0.33, 0.33, 0.34]);
  const [log, setLog] = useState<"log" | "linear">("log");
  const [best, setBest] = useState<{ w: number[]; sd: number } | null>(null);

  const sd = (x: number[]) => Math.sqrt(portfolioVariance(x, stats.Sigma));
  const mu = dot(w, stats.means);
  const risk = sd(w);
  useEffect(() => {
    setBest((b) => (!b || risk < b.sd - 1e-12 ? { w, sd: risk } : b));
  }, [w, risk]);

  const cloud = useMemo(() => simplexGrid(0.025).map((x) => ({ sd: sd(x), mu: dot(x, stats.means) })), [stats]);
  const longOnlyMin = useMemo(() => gridMinimum((x) => portfolioVariance(x, stats.Sigma), 0.005), [stats]);
  const optionRisks = OPTIONS.map((o) => sd(o.w));
  const bestOption = optionRisks.indexOf(Math.min(...optionRisks));
  const safestSingle = Math.min(...stats.sds);

  // Check: build the portfolio's actual monthly returns and measure their SD directly.
  const portfolioSeries = stats.returns[0].map((_, t) => w.reduce((s, wi, i) => s + wi * stats.returns[i][t], 0));
  const directSd = sampleStdDev(portfolioSeries);

  const indexed = prices.map((p) => p.map((v) => (100 * v) / p[0]));

  return (
    <>
      <PageHeader n={1} title="The problem" lead="Three assets, $1,000, and one question that needs surprisingly deep maths to answer properly." />

      <Question>You have $1,000 and three assets: the S&amp;P 500, gold and Solana. How should you split it?</Question>

      <GuessChoice
        id="home-lowest-risk"
        prompt="Before any theory: which of these splits do you think had the lowest month-to-month risk?"
        options={OPTIONS.map((o) => o.label)}
      />

      <Intuition>
        <p>
          Picture a shop that sells both umbrellas and sunglasses. Each product alone has good and bad months, depending on the
          weather. Sell both, and a bad month for one is often a good month for the other, so the shop&apos;s income is steadier than either product&apos;s.
        </p>
        <p style={{ marginBottom: 0 }}>
          Assets work the same way. What matters is not only how risky each one is, but <em>whether they tend to move together</em>.
        </p>
      </Intuition>


      <MathSteps
        steps={[
          {
            tex: "R_p = w_1R_1 + w_2R_2 + w_3R_3, \\qquad w_1+w_2+w_3 = 1",
            why: "Your portfolio's return is each asset's return, weighted by the fraction of money in it.",
            words: "Portfolio return = (share in S&P × S&P return) + (share in gold × gold return) + (share in Solana × Solana return).",
          },
          {
            tex: "\\mu_p = w_1\\mu_1 + w_2\\mu_2 + w_3\\mu_3 = \\mathbf{w}^{\\mathsf T}\\boldsymbol{\\mu}",
            why: "Averages pass straight through sums, so the mean return is just the weighted average of the three means.",
            words: "Average portfolio return = weighted average of the three average returns.",
          },
          {
            tex: "\\sigma_p^2 \\neq w_1\\sigma_1^2 + w_2\\sigma_2^2 + w_3\\sigma_3^2",
            why: (
              <>
                Risk is <em>not</em> a weighted average. Squaring a sum creates cross terms such as <M>{"2w_1w_2\\sigma_{12}"}</M> that depend on how the
                assets move together. Those cross terms are why diversifying works (page 4).
              </>
            ),
            words: "Portfolio risk is NOT the weighted average of the risks: how the assets move together also matters.",
          },
        ]}
      />

      <Experiment>
        <p>Drag the sliders to split your $1,000. They always add up to 100%.</p>
        <WeightSliders weights={w} onChange={setW} amount={AMOUNT} />
        <div className="stats" aria-live="polite">
          <div className="stat">
            <div className="label">Average monthly return</div>
            <div className="value">{pct(mu)}</div>
            <div className="sub">≈ {usd(mu * AMOUNT)} a month on {usd(AMOUNT, 0)}</div>
          </div>
          <div className="stat">
            <div className="label">Risk (std. dev. per month)</div>
            <div className="value">{pct(risk)}</div>
            <div className="sub">a typical month is ±{usd(risk * AMOUNT)} from average</div>
          </div>
          <div className="stat">
            <div className="label">Lowest risk you&apos;ve found</div>
            <div className="value">{best ? pct(best.sd) : "—"}</div>
            <div className="sub">{best ? best.w.map((x, i) => `${ASSETS[DEFAULT_ASSETS[i]].short} ${pct(x, 0)}`).join(" · ") : ""}</div>
          </div>
        </div>
        <Figure
          title="Where your mix sits: risk vs return"
          alt={`Risk-return map. S&P 500 risk ${pct(stats.sds[0])}, gold ${pct(stats.sds[1])}, Solana ${pct(stats.sds[2])}. Your portfolio: risk ${pct(risk)}, return ${pct(mu)}. Grey dots are other possible mixes.`}
          table={{
            header: ["Portfolio", "Risk (SD/month)", "Mean return/month"],
            rows: [...DEFAULT_ASSETS.map((a, i) => [ASSETS[a].name, stats.sds[i], stats.means[i]]), ["Your mix", risk, mu]],
          }}
          note={<p className="note">Grey dots: other ways of splitting the money without borrowing. Notice the left edge of the cloud bulges <em>left of every asset</em>.</p>}
        >
          <RiskReturnMap assetPoints={stats.sds.map((s, i) => ({ sd: s, mu: stats.means[i] }))} cloud={cloud} you={{ sd: risk, mu }} />
        </Figure>
      </Experiment>

      <Finding
        headline={
          <>
            Mixing lowers risk: the least risky mix without borrowing has a monthly risk of {pct(Math.sqrt(longOnlyMin.value))}, lower than the safest single asset ({pct(safestSingle)}, the S&amp;P 500).
          </>
        }
        guessId="home-lowest-risk"
        compare={(g) =>
          g.value === bestOption ? (
            <>Correct: “{OPTIONS[bestOption].label}” had the lowest risk ({pct(optionRisks[bestOption])}).</>
          ) : (
            <>
              The lowest of the four was actually “{OPTIONS[bestOption].label}” at {pct(optionRisks[bestOption])}; yours was {pct(optionRisks[Number(g.value)])}.
            </>
          )
        }
      >
        <p>
          That minimum is roughly {longOnlyMin.weights.map((x, i) => `${pct(x, 0)} ${ASSETS[DEFAULT_ASSETS[i]].short}`).join(", ")}. The rest of this site
          works out <em>exactly</em> where it is, and how it moves when you ask for more return. That is the research question:
        </p>
        <p style={{ fontStyle: "italic" }}>
          How does the minimum-risk allocation change as the target monthly return increases, and for which targets can it be achieved without short-selling?
        </p>
      </Finding>

      <Check>
        <p>
          The risk figure above came from a formula. Check it the slow way: build your portfolio&apos;s actual return for each of the {portfolioSeries.length} months,
          then take the standard deviation of that list directly.
        </p>
        <div className="stats">
          <div className="stat"><div className="label">From the formula <M>{"\\sqrt{\\mathbf w^{\\mathsf T}\\Sigma\\mathbf w}"}</M></div><div className="value">{(risk * 100).toFixed(6)}%</div></div>
          <div className="stat"><div className="label">Directly from {portfolioSeries.length} monthly portfolio returns</div><div className="value">{(directSd * 100).toFixed(6)}%</div></div>
        </div>
        <p className="note" style={{ marginBottom: 0 }}>They agree to every digit shown. That&apos;s not a coincidence: page 5 shows why.</p>
      </Check>

      <h2 style={{ marginTop: 32 }}>The real price history</h2>
      <Figure
        title="Growth of $100 invested in August 2023"
        alt="Line chart of each asset indexed to 100 in August 2023. Solana rises most steeply and then falls back; gold rises steadily; the S&P 500 rises steadily."
        table={{ header: ["Month", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: months.map((m, t) => [m, ...prices.map((p) => p[t])]) }}
        note={
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />
            <Segmented label="Scale" value={log} onChange={setLog} options={[{ value: "log", label: "Log scale" }, { value: "linear", label: "Linear" }]} />
          </div>
        }
      >
        <TimeChart
          months={months}
          yLog={log === "log"}
          yFormat={(v) => `$${Math.round(v)}`}
          yLabel="Value of $100"
          series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: indexed[i] }))}
        />
      </Figure>
      <p className="note">
        On a log scale, equal vertical distances mean equal percentage changes. That is a fairer way to compare an asset that trebled with one that rose 70%.
      </p>

      <h3>The same assets on TradingView</h3>
      <p className="note">
        These are for context only: TradingView has no public data API, so every calculation on this site uses FRED, World Bank and Kraken data (see <Link href="/data">Data &amp; provenance</Link>).
      </p>
      <div className="tv-grid">
        {DEFAULT_ASSETS.map((a) => (
          <TradingViewMini key={a} symbol={ASSETS[a].tradingViewSymbol} title={ASSETS[a].name} />
        ))}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        Tip: switch on <strong>classmate mode</strong> in the sidebar to swap symbols for words. The <Link href="/glossary">glossary</Link> explains every term.
      </p>
    </>
  );
}
