"use client";
import { useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { WeightLines } from "@/components/charts/WeightLines";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct } from "@/lib/format";
import { optimalWeights } from "@/lib/math";
import { useModel } from "@/lib/useModel";

export function ShortSelling() {
  const { k, linear, zeros, stats } = useModel();
  const { g, h } = linear;
  const band = zeros.noShortInterval;
  const [target, setTarget] = useState(0.025);
  const w = optimalWeights(k, target).weights;
  const shorted = DEFAULT_ASSETS.filter((_, i) => w[i] < -1e-12);
  const options = [
    `Any target between the lowest and highest asset returns (${pct(Math.min(...stats.means))} to ${pct(Math.max(...stats.means))})`,
    "Only a narrow band, about 2% to 3% a month",
    "Only the single minimum-risk portfolio",
    "None: some asset is always shorted",
  ];
  const answer = !band ? 3 : band.upper - band.lower < 0.015 ? 1 : 0;
  const binding = (edge: number) => DEFAULT_ASSETS.find((_, i) => zeros.crossings[i] !== null && Math.abs((zeros.crossings[i] as number) - edge) < 1e-12);

  return (
    <>
      <GuessChoice id="explore-noshort" prompt="For which target returns can the minimum-risk portfolio be built with no negative weights (no short-selling)?" options={options} />
      <Intuition>
        <p>Each weight is a straight line, and a straight line crosses zero at most once. Before (or after) that point, the asset is held <em>negatively</em>: it is shorted.</p>
        <p style={{ marginBottom: 0 }}>So the “safe” targets are where all three lines are above zero at the same time: an interval, bounded by the first crossings on each side.</p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "w_i(\\mu^*) = g_i + h_i\\mu^* = 0 \\iff \\mu^* = \\mu_i := -\\frac{g_i}{h_i}", why: "Set one line to zero and solve.", words: "Each asset's weight hits zero at one particular target." },
          { tex: "h_i > 0:\\; w_i \\ge 0 \\iff \\mu^* \\ge \\mu_i, \\qquad h_i < 0:\\; w_i \\ge 0 \\iff \\mu^* \\le \\mu_i", why: "A rising line is non-negative to the right of its root; a falling line to the left.", words: "Rising lines are safe after their zero; falling lines are safe before theirs." },
          { tex: "\\mu^* \\in \\Big[\\max_{h_i>0}\\mu_i,\\; \\min_{h_i<0}\\mu_i\\Big]", why: "All three conditions must hold at once, so intersect the half-lines.", words: "The safe band runs from the latest “rising” zero to the earliest “falling” zero." },
          {
            tex: zeros.crossings.map((c, i) => `\\mu_{\\text{${ASSETS[DEFAULT_ASSETS[i]].short.replace("&", "\\&")}}} = ${c === null ? "\\text{none}" : (c * 100).toFixed(4) + "\\%"}`).join(",\\quad "),
            why: `With the IA data: h is positive for gold and Solana and negative for the S&P 500.`,
            words: "The three zero-crossing targets.",
          },
        ]}
      />
      <Experiment>
        <Slider label={<>Target <M>{"\\mu^*"}</M></>} value={target} min={0.005} max={0.04} step={0.0005} onChange={setTarget} format={(v) => pct(v)} />
        <p aria-live="polite">
          {shorted.length === 0 ? (
            <strong className="pos">No short-selling needed at {pct(target)}.</strong>
          ) : (
            <strong className="neg">At {pct(target)} you must short {shorted.map((a) => ASSETS[a].name).join(" and ")}.</strong>
          )}
        </p>
        <Figure
          title="Where each weight crosses zero"
          alt={`Weight lines with zero-crossings marked. The shaded no-short-selling band runs from ${band ? pct(band.lower, 3) : "—"} to ${band ? pct(band.upper, 3) : "—"}.`}
          table={{ header: ["Asset", "g", "h", "zero at μ*"], rows: DEFAULT_ASSETS.map((a, i) => [ASSETS[a].name, g[i], h[i], zeros.crossings[i] ?? "none"]) }}
          note={<Legend items={DEFAULT_ASSETS.map((x) => ({ label: ASSETS[x].name, color: ASSETS[x].color }))} />}
        >
          <WeightLines g={g} h={h} from={0.005} to={0.04} target={target} crossings={zeros.crossings} band={band} />
        </Figure>
      </Experiment>
      <Finding
        headline={
          band ? (
            <>The minimum-risk portfolio avoids short-selling only for targets between {pct(band.lower, 3)} and {pct(band.upper, 3)} a month. Below that Solana is shorted; above it the S&amp;P 500 is.</>
          ) : (
            <>With this data there is no target at which every weight is non-negative.</>
          )
        }
        guessId="explore-noshort"
        compare={(gs) => (gs.value === answer ? "Correct!" : `The answer was “${options[answer]}”.`)}
      >
        {band && (
          <p>
            This answers the second half of the research question. The lower end is set by {binding(band.lower) ? ASSETS[binding(band.lower)!].name : "—"} reaching zero,
            the upper end by {binding(band.upper) ? ASSETS[binding(band.upper)!].name : "—"}. The minimum-variance portfolio itself ({pct(k.B / k.A, 3)}) lies
            <em> below</em> the band, which is why it shorts Solana (investigation 4).
          </p>
        )}
      </Finding>
      {band && (
        <Check>
          <p>At the two ends of the band, exactly one weight should be zero:</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>μ*</th>{DEFAULT_ASSETS.map((a) => <th key={a}>{ASSETS[a].name}</th>)}</tr></thead>
              <tbody>
                {[band.lower - 0.001, band.lower, band.upper, band.upper + 0.001].map((m) => (
                  <tr key={m}><td>{pct(m, 4)}</td>{optimalWeights(k, m).weights.map((x, i) => <td key={i} className={x < -1e-12 ? "neg" : undefined}>{Math.abs(x) < 1e-12 ? "0" : x.toFixed(5)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Check>
      )}
    </>
  );
}
