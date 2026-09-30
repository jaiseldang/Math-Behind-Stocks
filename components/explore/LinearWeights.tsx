"use client";
import { useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { WeightLines } from "@/components/charts/WeightLines";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, sig, texNum } from "@/lib/format";
import { optimalWeights, sum } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const SHAPES = ["Straight lines", "Curves that bend upwards", "S-shaped curves", "Curves that level off"];

export function LinearWeights() {
  const { k, linear } = useModel();
  const { g, h } = linear;
  const [target, setTarget] = useState(0.02);
  const [revealed, setRevealed] = useState(false);
  const a = 0.015;
  const b = 0.03;
  const wa = optimalWeights(k, a).weights;
  const wb = optimalWeights(k, b).weights;
  const wm = optimalWeights(k, (a + b) / 2).weights;
  const range = [0.005, 0.04] as const;
  const table = { header: ["Target μ*", ...DEFAULT_ASSETS.map((x) => ASSETS[x].name)], rows: Array.from({ length: 36 }, (_, i) => { const m = 0.005 + i * 0.001; return [m, ...g.map((gi, j) => gi + h[j] * m)]; }) };

  return (
    <>
      <GuessChoice id="explore-shape" prompt="If you plot each optimal weight against the target return μ*, what shape do you expect?" options={SHAPES} />
      <Intuition>
        <p>
          Think of the three weights as buckets of water that must always hold exactly 1 litre in total. Raising the target means pouring water from the
          low-return bucket into the high-return ones.
        </p>
        <p style={{ marginBottom: 0 }}>The question is whether the pouring speeds up, slows down, or stays steady as the target rises.</p>
      </Intuition>
      <MathSteps
        steps={[
          { tex: "\\lambda_1 = \\frac{2(C-B\\mu^*)}{D},\\qquad \\lambda_2 = \\frac{2(A\\mu^*-B)}{D}", why: "From page 7. Both multipliers are linear functions of μ*.", words: "Both helper numbers change in a straight line with the target." },
          { tex: "\\mathbf w = \\tfrac12\\left(\\lambda_1\\Sigma^{-1}\\mathbf 1 + \\lambda_2\\Sigma^{-1}\\boldsymbol\\mu\\right)", why: "The weights are a fixed combination of the λs, so they are linear in μ* too.", words: "The weights are built from them, so they change in a straight line too." },
          { tex: "\\mathbf w(\\mu^*) = \\underbrace{\\frac{C\\Sigma^{-1}\\mathbf 1 - B\\Sigma^{-1}\\boldsymbol\\mu}{D}}_{\\mathbf g} + \\mu^*\\,\\underbrace{\\frac{A\\Sigma^{-1}\\boldsymbol\\mu - B\\Sigma^{-1}\\mathbf 1}{D}}_{\\mathbf h}", why: "Substitute the λs and collect the terms without μ* (g) and with μ* (h).", words: "Weights = a starting mix g, plus the target times a direction h." },
          { tex: `\\mathbf g = \\begin{pmatrix}${g.map((x) => texNum(x, 5)).join("\\\\")}\\end{pmatrix},\\quad \\mathbf h = \\begin{pmatrix}${h.map((x) => texNum(x, 5)).join("\\\\")}\\end{pmatrix}`, why: "With the IA data. h is the slope of each line: the change in weight per unit of target return.", words: "The actual numbers." },
          { tex: "\\textstyle\\sum g_i = \\frac{CA - B^2}{D} = 1, \\qquad \\sum h_i = \\frac{AB - BA}{D} = 0", why: "Summing the entries of Σ⁻¹1 gives A and of Σ⁻¹μ gives B. So the weights always sum to 1, whatever μ* is.", words: "The starting mix adds to 100%, and the direction adds to 0%." },
        ]}
      />
      <Experiment>
        <Slider label={<>Target <M>{"\\mu^*"}</M></>} value={target} min={range[0]} max={range[1]} step={0.0005} onChange={setTarget} format={(v) => pct(v)} />
        {!revealed && (
          <p className="note">
            The lines are hidden so you can test your guess. The dots show the weights at your target. Drag the slider and watch how they move.{" "}
            <button className="btn primary" onClick={() => setRevealed(true)}>Reveal the full lines</button>
          </p>
        )}
        <Figure title="Optimal weights against the target return" alt="Each optimal weight is a straight line in the target return: S&P 500 falls, gold and Solana rise." table={table} note={<Legend items={DEFAULT_ASSETS.map((x) => ({ label: ASSETS[x].name, color: ASSETS[x].color }))} />}>
          {revealed ? <WeightLines g={g} h={h} from={range[0]} to={range[1]} target={target} /> : <DotsOnly g={g} h={h} target={target} range={range} />}
        </Figure>
        <div className="stats">
          {DEFAULT_ASSETS.map((x, i) => (
            <div className="stat" key={x}><div className="label">{ASSETS[x].name}</div><div className="value">{pct(g[i] + h[i] * target, 1)}</div><div className="sub">slope h = {sig(h[i], 4)}</div></div>
          ))}
        </div>
      </Experiment>
      <Finding
        headline={<>The weights are exact straight lines: every extra 1% of monthly target moves {pct(-h[0] / 100, 1)} of the money out of the S&amp;P 500, {pct(h[1] / 100, 1)} into gold and {pct(h[2] / 100, 1)} into Solana.</>}
        guessId="explore-shape"
        compare={(gs) => (gs.value === 0 ? "Correct: straight lines." : "They are straight lines, because λ₁ and λ₂ are linear in μ*.")}
      >
        <p>Σh = 0 means raising the target only <em>moves</em> money between assets; it never creates or destroys any.</p>
      </Finding>
      <Check>
        <p>
          For a straight line, the midpoint of two inputs gives the midpoint of the outputs. Check with μ* = {pct(a)} and {pct(b)}:
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Asset</th><th>w({pct(a)})</th><th>w({pct(b)})</th><th>average</th><th>w({pct((a + b) / 2)})</th></tr></thead>
            <tbody>
              {DEFAULT_ASSETS.map((x, i) => (
                <tr key={x}><td>{ASSETS[x].name}</td><td>{wa[i].toFixed(6)}</td><td>{wb[i].toFixed(6)}</td><td>{((wa[i] + wb[i]) / 2).toFixed(6)}</td><td>{wm[i].toFixed(6)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Σg = {sum(g).toFixed(12)}, Σh = {sum(h).toExponential(2)} (zero up to rounding).</p>
      </Check>
    </>
  );
}

function DotsOnly({ g, h, target, range }: { g: number[]; h: number[]; target: number; range: readonly [number, number] }) {
  // Same axes as the full chart, but only the current point, so the shape isn't given away.
  return <WeightLines g={g} h={h} from={range[0]} to={range[1]} target={target} showLines={false} />;
}
