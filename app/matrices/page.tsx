"use client";
import { useState } from "react";
import { Figure } from "@/components/charts/Figure";
import { Check, Experiment, Finding, GuessSlider, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { Eq, M } from "@/components/pattern/Tex";
import { Slider } from "@/components/ui/Slider";
import { WeightSliders } from "@/components/ui/WeightSliders";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { sig, tex, texMatrixPlain, texNum } from "@/lib/format";
import { dot, matVec, multiply, quadraticForm, transpose, varianceTerms } from "@/lib/math";
import { useModel } from "@/lib/useModel";

const distinct = (n: number) => (n * (n + 1)) / 2;

export default function MatricesPage() {
  const { stats } = useModel();
  const S = stats.Sigma;
  const [w, setW] = useState([0.5, 0.4, 0.1]);
  const [n, setN] = useState(3);
  const Sw = matVec(S, w);
  const quad = dot(w, Sw);
  const viaMatrices = multiply(multiply([w], S), transpose([w]))[0][0];
  const termSum = varianceTerms(w, S).reduce((s, t) => s + t.value, 0);

  return (
    <>
      <PageHeader n={5} title="Why matrices" lead="Writing the same risk formula in a way that doesn't explode as you add assets." />

      <Question>The risk formula for 3 assets has 6 terms. How many would it have for all 500 companies in the S&amp;P 500?</Question>

      <GuessSlider id="matrices-500" prompt="Guess the number of different terms (squares plus distinct cross terms) for 500 assets." min={500} max={250000} step={250} initial={2500} format={(v) => v.toLocaleString("en-US")} />

      <Intuition>
        <p>
          Picture a multiplication table with the assets along the top and down the side. Every cell pairs asset <em>i</em> with asset <em>j</em>, and
          holds &ldquo;how much they move together, times how much of each you own&rdquo;.
        </p>
        <p style={{ marginBottom: 0 }}>
          The table is symmetric (S&amp;P-with-gold is the same as gold-with-S&amp;P), so the distinct terms are the diagonal plus one triangle. The whole
          table can be written as one object: a <strong>matrix</strong>.
        </p>
      </Intuition>

      <MathSteps
        stacked
        intro={<p className="note">Using your weights from the experiment below, w = ({w.map((x) => x.toFixed(2)).join(", ")}).</p>}
        steps={[
          { tex: `\\mathbf w = ${texMatrixPlain(w.map((x) => [x]), 3)},\\qquad \\Sigma = ${texMatrixPlain(S, 3)}`, why: "Put the weights in a column vector and all variances/covariances in a 3×3 matrix. The diagonal holds the variances σᵢ².", words: "List the weights in a column, and put every variance and covariance in a 3-by-3 table." },
          { tex: `\\Sigma\\mathbf w = ${texMatrixPlain(Sw.map((x) => [x]), 4)}`, why: "Row i of Σw is σᵢ₁w₁ + σᵢ₂w₂ + σᵢ₃w₃: how much asset i co-moves with the whole portfolio.", words: "Multiply the table by the weights: each row says how much that asset moves with your whole portfolio." },
          { tex: `\\mathbf w^{\\mathsf T}(\\Sigma\\mathbf w) = ${w.map((x, i) => `(${tex(x, 3)})(${texNum(Sw[i], 4)})`).join(" + ")} = ${texNum(quad, 5)}`, why: "Multiply each weight by its row of Σw and add: a dot product. This weights each asset's co-movement by how much you hold.", words: "Weight each of those by how much you own, and add." },
          { tex: "\\mathbf w^{\\mathsf T}\\Sigma\\mathbf w = \\sum_{i=1}^{3}\\sum_{j=1}^{3} w_iw_j\\sigma_{ij}", why: "Writing out the two multiplications gives all 9 cells of the table. Since σᵢⱼ = σⱼᵢ, the 6 off-diagonal cells pair up into the 3 cross terms 2wᵢwⱼσᵢⱼ.", words: "This adds up all nine cells of the table; the matching off-diagonal cells pair up." },
          { tex: "\\sigma_p^2 = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w \\quad\\text{for any number of assets } n", why: "The formula doesn't change as n grows; only the sizes of w and Σ do. Page 7 needs this, because the Lagrange method works on the whole vector at once.", words: "The same short formula works for any number of assets." },
        ]}
      />

      <Experiment title="Experiment A: the table behind wᵀΣw">
        <WeightSliders weights={w} onChange={setW} />
        <Figure
          title="Each cell is wᵢ wⱼ σᵢⱼ"
          alt={`3 by 3 grid of the terms w_i w_j sigma_ij. Their sum is ${sig(quad, 4)}.`}
          table={{ header: ["", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: DEFAULT_ASSETS.map((a, i) => [ASSETS[a].name, ...DEFAULT_ASSETS.map((_, j) => w[i] * w[j] * S[i][j])]) }}
        >
          <CellGrid w={w} S={S} />
        </Figure>
        <p className="note">Blue cells add risk, red cells remove it. The two S&amp;P–gold cells are the same, so they appear as one term 2w₁w₂σ₁₂ in the formula.</p>
      </Experiment>

      <Experiment title="Experiment B: counting terms as n grows">
        <Slider label="Number of assets n" value={n} min={2} max={500} step={1} onChange={setN} format={(v) => String(v)} />
        <div className="stats">
          <div className="stat"><div className="label">Cells in the table (n²)</div><div className="value">{(n * n).toLocaleString()}</div></div>
          <div className="stat"><div className="label">Variances (diagonal)</div><div className="value">{n.toLocaleString()}</div></div>
          <div className="stat"><div className="label">Distinct covariances n(n−1)/2</div><div className="value">{((n * (n - 1)) / 2).toLocaleString()}</div></div>
          <div className="stat"><div className="label">Distinct terms n(n+1)/2</div><div className="value">{distinct(n).toLocaleString()}</div></div>
        </div>
        {n <= 24 ? <TriangleGrid n={n} /> : <p className="note">(The picture is drawn for n ≤ 24.)</p>}
        <Eq>{`\\text{written out: } ${distinct(n).toLocaleString("en-US").replace(/,/g, "{,}")}\\text{ terms} \\qquad\\text{as a matrix: } \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w`}</Eq>
      </Experiment>

      <Finding
        headline={<>Three assets give 6 terms, but 500 assets give {distinct(500).toLocaleString()} terms. In matrix form it is always just <M>{"\\mathbf w^{\\mathsf T}\\Sigma\\mathbf w"}</M>.</>}
        guessId="matrices-500"
        compare={(g) => {
          const r = Number(g.value) / distinct(500);
          return r > 0.8 && r < 1.25 ? "Close!" : `Most people ${r < 1 ? "underestimate" : "overestimate"} it; the count grows like n²/2.`;
        }}
      >
        <p>The number of terms grows like n²/2, so writing it out by hand quickly becomes impossible. The matrix form is what lets the method scale.</p>
      </Finding>

      <Check>
        <p>Three different routes to the same variance for your weights:</p>
        <div className="stats">
          <div className="stat"><div className="label">Six-term sum (page 4)</div><div className="value">{termSum.toExponential(8)}</div></div>
          <div className="stat"><div className="label">wᵀ(Σw), dot product</div><div className="value">{quadraticForm(w, S).toExponential(8)}</div></div>
          <div className="stat"><div className="label">(1×3)(3×3)(3×1) matrix product</div><div className="value">{viaMatrices.toExponential(8)}</div></div>
        </div>
      </Check>
    </>
  );
}

function CellGrid({ w, S }: { w: number[]; S: number[][] }) {
  const vals = w.map((wi, i) => w.map((wj, j) => wi * wj * S[i][j]));
  const max = Math.max(...vals.flat().map(Math.abs)) || 1;
  const cell = 92;
  const off = 80;
  const size = off + cell * 3 + 4;
  const [hover, setHover] = useState<[number, number] | null>(null);
  return (
    <div className="chart-wrap" style={{ overflowX: "auto" }}>
      <svg className="chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ width: size, maxWidth: "100%" }}>
        {DEFAULT_ASSETS.map((a, i) => (
          <g key={a}>
            <text x={off + i * cell + cell / 2} y={off - 10} textAnchor="middle" className="label">{ASSETS[a].short}</text>
            <text x={off - 8} y={off + i * cell + cell / 2} textAnchor="end" dy="0.32em" className="label">{ASSETS[a].short}</text>
          </g>
        ))}
        {vals.map((row, i) =>
          row.map((v, j) => {
            const alpha = 0.12 + 0.75 * (Math.abs(v) / max);
            return (
              <g key={`${i}${j}`} onPointerEnter={() => setHover([i, j])} onPointerLeave={() => setHover(null)}>
                <rect x={off + j * cell + 2} y={off + i * cell + 2} width={cell - 4} height={cell - 4} rx={6}
                  fill={v >= 0 ? `rgba(42,120,214,${alpha})` : `rgba(227,73,72,${alpha})`}
                  stroke={hover && hover[0] === j && hover[1] === i ? "var(--ink)" : i === j ? "var(--ink-2)" : "none"} strokeWidth={i === j ? 1.5 : 2} />
                <text x={off + j * cell + cell / 2} y={off + i * cell + cell / 2 - 7} textAnchor="middle" style={{ fontSize: 11, fill: "var(--ink)" }}>{`w${i + 1}w${j + 1}σ${i + 1}${j + 1}`}</text>
                <text x={off + j * cell + cell / 2} y={off + i * cell + cell / 2 + 10} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: "var(--ink)" }}>{sig(v, 3)}</text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function TriangleGrid({ n }: { n: number }) {
  const size = Math.min(320, n * 22);
  const c = size / n;
  return (
    <svg className="chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ width: size }} role="img" aria-label={`${n} by ${n} grid with the diagonal and upper triangle shaded: ${distinct(n)} distinct terms.`}>
      {Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (
          <rect key={`${i}-${j}`} x={j * c + 1} y={i * c + 1} width={c - 2} height={c - 2} rx={2}
            fill={i === j ? "var(--c-frontier)" : j > i ? "var(--c-spx)" : "var(--surface-2)"} opacity={j >= i ? 0.85 : 1} />
        )),
      )}
    </svg>
  );
}
