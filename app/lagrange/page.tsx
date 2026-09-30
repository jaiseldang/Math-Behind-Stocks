"use client";
import { contours, geoPath, geoTransform } from "d3";
import { useMemo, useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, Intuition, MathSteps, PageHeader, Question, Stage } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { useGuess } from "@/components/providers";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, sig } from "@/lib/format";
import {
  constraintGradient, dot, frontierVariance, fullWeights, goldenMin, lineW2, optimalWeights,
  planeGradient, planeVariance, projectOntoLine, type LagrangeConstants,
} from "@/lib/math";
import { useModel } from "@/lib/useModel";

const GAME_TARGET = 0.02;
const GRID = 140;

export default function LagrangePage() {
  const { k, stats, mvp } = useModel();
  const [target, setTarget] = useState(GAME_TARGET);
  const [probe, setProbe] = useState(0.2); // w₁ of the probe point on the line
  const [guess, setGuess] = useGuess("lagrange-game");
  const opt = optimalWeights(k, target);
  const gameOpt = optimalWeights(k, GAME_TARGET);

  // Plot domain: large enough to hold the optimum for every target on the slider.
  const domain = useMemo(() => {
    const ends = [0.01, 0.034].map((t) => optimalWeights(k, t).weights);
    const xs = [...ends.map((w) => w[0]), mvp.weights[0]];
    const ys = [...ends.map((w) => w[1]), mvp.weights[1]];
    const pad = 0.3;
    return { x: [Math.min(...xs) - pad, Math.max(...xs) + pad] as [number, number], y: [Math.min(...ys) - pad, Math.max(...ys) + pad] as [number, number] };
  }, [k, mvp]);

  // Numerical check: minimise along the line by golden-section search (no calculus).
  const numeric = goldenMin((t) => planeVariance(stats.Sigma, t, lineW2(stats.means, target, t)), domain.x[0] - 5, domain.x[1] + 5);

  return (
    <>
      <PageHeader n={6} title="Lagrange multipliers: the idea" lead="The picture behind the method, before any heavy algebra." />

      <Question>If you insist on a particular return, where is the lowest-risk portfolio, and how would you recognise it?</Question>

      <Stage kind="guess" title="Your guess: find the lowest point yourself">
        <p>
          Every point in the square is a way to split your money (the Solana share is whatever is left over). The straight line shows all mixes that earn exactly{" "}
          <strong>{pct(GAME_TARGET)}</strong> a month. <strong>Click on the line</strong>, or use the slider, to find the point with the lowest risk. Then lock it in.
        </p>
        <Plane k={k} domain={domain} target={GAME_TARGET} probe={probe} setProbe={setProbe} reveal={false} />
        <Slider label="Move along the line (w₁)" value={probe} min={domain.x[0]} max={domain.x[1]} step={0.005} onChange={setProbe} format={(v) => pct(v, 1)} />
        <ProbeReadout k={k} target={GAME_TARGET} w1={probe} />
        <div className="btn-row">
          <button
            className="btn primary"
            onClick={() => {
              const w = fullWeights(probe, lineW2(k.mu, GAME_TARGET, probe));
              setGuess({ value: Math.sqrt(planeVariance(k.Sigma, w[0], w[1])), label: `σ = ${pct(Math.sqrt(planeVariance(k.Sigma, w[0], w[1])), 3)} at w = (${w.map((x) => x.toFixed(2)).join(", ")})` });
            }}
          >
            Lock in this point
          </button>
          {guess && <span className="note" style={{ alignSelf: "center" }}>Locked in: {guess.label}</span>}
        </div>
      </Stage>

      <Intuition>
        <p>
          Imagine the risk as a valley. The ellipses are contour lines on a map, like lines of equal height. You must walk along a straight path (the return
          constraint) and want to stop at its lowest point.
        </p>
        <p style={{ marginBottom: 0 }}>
          While you are still crossing contour lines, you are going downhill (or uphill). You reach the lowest point exactly when the path <strong>just touches</strong> a contour
          and doesn&apos;t cross it: the path is <strong>tangent</strong> to an ellipse there.
        </p>
      </Intuition>

      <MathSteps
        steps={[
          { tex: "\\begin{aligned}&\\min_{\\mathbf w}\\; \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w \\quad\\text{subject to}\\\\ &w_1+w_2+w_3=1,\\quad \\mu_1w_1+\\mu_2w_2+\\mu_3w_3=\\mu^*\\end{aligned}", why: "The problem: lowest variance, spend all the money, hit the target.", words: "Find the weights with the least risk that use all the money and hit the target return." },
          { tex: "f(w_1,w_2) = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w,\\quad \\mathbf w = (w_1,\\, w_2,\\, 1-w_1-w_2)", why: "Substituting w₃ uses up the budget constraint. Now f is a quadratic in two variables, a bowl whose level curves are ellipses (because Σ is positive definite).", words: "Replace the Solana share by “whatever is left”, so risk depends only on two numbers." },
          { tex: "g(w_1,w_2) = (\\mu_1-\\mu_3)w_1 + (\\mu_2-\\mu_3)w_2 = \\mu^*-\\mu_3", why: "The return constraint after the same substitution. It is linear, so it is a straight line in the plane.", words: "The target return becomes a straight line." },
          { tex: "\\nabla f \\perp \\text{contour of } f, \\qquad \\nabla g \\perp \\text{the line } g = c", why: "A gradient always points straight uphill, which is perpendicular to its level curve (moving along a level curve doesn't change the value).", words: "The steepest-uphill arrow is always at right angles to the contour line." },
          { tex: "\\text{at the optimum: contour tangent to line} \\;\\Rightarrow\\; \\nabla f = \\lambda\\,\\nabla g", why: "At the tangent point, the contour and the line share a direction, so their perpendiculars are parallel: one is a multiple λ of the other. λ is the Lagrange multiplier.", words: "At the best point, the uphill arrow of risk and the arrow of the constraint point the same way." },
          { tex: "2\\Sigma\\mathbf w = \\lambda_1\\mathbf 1 + \\lambda_2\\boldsymbol\\mu", why: "The same idea without substituting: one multiplier per constraint. Page 7 solves this. The λ in the picture turns out to be exactly λ₂.", words: "With both constraints kept, there are two multipliers, λ₁ and λ₂." },
        ]}
      />

      <Experiment>
        <p>Now change the target, reveal the optimum, and compare the gradient arrows at the optimum with those at your probe point.</p>
        <Slider label={<>Target <M>{"\\mu^*"}</M></>} value={target} min={0.01} max={0.034} step={0.0005} onChange={setTarget} format={(v) => pct(v, 2)} />
        <Plane k={k} domain={domain} target={target} probe={probe} setProbe={setProbe} reveal />
        <Slider label="Probe along the line (w₁)" value={probe} min={domain.x[0]} max={domain.x[1]} step={0.005} onChange={setProbe} format={(v) => pct(v, 1)} />
        <div className="grid-2">
          <GradientTable title="At the optimum" k={k} target={target} w1={opt.weights[0]} />
          <GradientTable title="At your probe" k={k} target={target} w1={probe} />
        </div>
        <p className="note">
          At the optimum the two ratios are equal (the arrows are parallel), and both equal λ₂ = {sig(opt.lambda2, 5)} from page 7. At any other point on the line they differ.
        </p>
      </Experiment>

      <Finding
        headline={
          <>
            For a {pct(GAME_TARGET)} target, the lowest risk is σ = {pct(gameOpt.sd, 3)}, at w = ({gameOpt.weights.map((x) => x.toFixed(3)).join(", ")}): exactly where the line touches an ellipse.
          </>
        }
        guessId="lagrange-game"
        compare={(g) => {
          const d = Number(g.value) - gameOpt.sd;
          return d < 0.00005 ? "You found it (to 3 decimal places)!" : `Your point was ${pct(d, 3)} riskier than the minimum.`;
        }}
      >
        <p>Tangency gives a condition, ∇f = λ∇g, that can be solved with algebra instead of trial and error. That is the whole idea of Lagrange multipliers.</p>
      </Finding>

      <Check>
        <p>A computer search that knows no calculus (golden-section search along the line) gives the same point:</p>
        <div className="stats">
          <div className="stat"><div className="label">Search: w₁</div><div className="value">{numeric.toFixed(6)}</div></div>
          <div className="stat"><div className="label">Lagrange: w₁</div><div className="value">{opt.weights[0].toFixed(6)}</div></div>
          <div className="stat"><div className="label">Search: σ</div><div className="value">{pct(Math.sqrt(planeVariance(stats.Sigma, numeric, lineW2(stats.means, target, numeric))), 4)}</div></div>
          <div className="stat"><div className="label">Frontier formula σ</div><div className="value">{pct(Math.sqrt(frontierVariance(k, target)), 4)}</div></div>
        </div>
      </Check>
    </>
  );
}

function ProbeReadout({ k, target, w1 }: { k: LagrangeConstants; target: number; w1: number }) {
  const w = fullWeights(w1, lineW2(k.mu, target, w1));
  return (
    <div className="stats">
      {DEFAULT_ASSETS.map((a, i) => (
        <div key={a} className="stat"><div className="label">{ASSETS[a].name}</div><div className="value">{pct(w[i], 1)}</div></div>
      ))}
      <div className="stat"><div className="label">Return</div><div className="value">{pct(dot(w, k.mu))}</div></div>
      <div className="stat"><div className="label">Risk σ</div><div className="value">{pct(Math.sqrt(planeVariance(k.Sigma, w[0], w[1])), 3)}</div></div>
    </div>
  );
}

function GradientTable({ title, k, target, w1 }: { title: string; k: LagrangeConstants; target: number; w1: number }) {
  const w2 = lineW2(k.mu, target, w1);
  const gf = planeGradient(k.Sigma, w1, w2);
  const gg = constraintGradient(k.mu);
  return (
    <div className="stat">
      <div className="label">{title} (w₁ = {w1.toFixed(3)}, w₂ = {w2.toFixed(3)})</div>
      <table className="data">
        <tbody>
          <tr><td>∇f</td><td>({sig(gf[0], 4)}, {sig(gf[1], 4)})</td></tr>
          <tr><td>∇g</td><td>({sig(gg[0], 4)}, {sig(gg[1], 4)})</td></tr>
          <tr><td>ratios ∂f/∂g</td><td>{sig(gf[0] / gg[0], 4)} and {sig(gf[1] / gg[1], 4)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function Plane({
  k, domain, target, probe, setProbe, reveal,
}: {
  k: LagrangeConstants;
  domain: { x: [number, number]; y: [number, number] };
  target: number;
  probe: number;
  setProbe: (v: number) => void;
  reveal: boolean;
}) {
  const S = k.Sigma;
  const [hover, setHover] = useState<{ w1: number; w2: number; px: number; py: number } | null>(null);
  const opt = optimalWeights(k, target);
  const optVar = frontierVariance(k, target);
  const minVar = 1 / k.A;

  // Variance on a grid, for the contour ellipses.
  const grid = useMemo(() => {
    const vals = new Float64Array(GRID * GRID);
    for (let j = 0; j < GRID; j++) {
      const w2 = domain.y[0] + ((domain.y[1] - domain.y[0]) * j) / (GRID - 1);
      for (let i = 0; i < GRID; i++) {
        const w1 = domain.x[0] + ((domain.x[1] - domain.x[0]) * i) / (GRID - 1);
        vals[j * GRID + i] = planeVariance(S, w1, w2);
      }
    }
    return vals;
  }, [S, domain]);
  const levels = useMemo(() => [1.03, 1.12, 1.3, 1.6, 2.1, 2.9, 4, 5.5, 7.5].map((r) => minVar * r * r), [minVar]);
  const shapes = useMemo(() => contours().size([GRID, GRID]).thresholds(levels)(Array.from(grid)), [grid, levels]);
  const tangent = useMemo(() => contours().size([GRID, GRID]).thresholds([optVar])(Array.from(grid)), [grid, optVar]);

  const w2p = lineW2(k.mu, target, probe);
  const gg = constraintGradient(k.mu);

  return (
    <Figure
      title={`Risk contours and the ${pct(target)} target line`}
      caption="Computed from the covariance matrix and mean returns of the current dataset. The Solana weight is 1 − w₁ − w₂."
      alt={`Contour map of portfolio risk over w1 (S&P 500 weight) and w2 (gold weight). Ellipses are equal-risk curves; a straight line marks all mixes returning ${pct(target)}.${reveal ? ` The optimum is at w1 = ${opt.weights[0].toFixed(3)}, w2 = ${opt.weights[1].toFixed(3)}.` : ""}`}
      note={<Legend items={[{ label: "Equal-risk ellipses", color: "var(--c-neutral)" }, { label: `Mixes returning ${pct(target)}`, color: "var(--c-frontier)" }, ...(reveal ? [{ label: "Tangent ellipse", color: "var(--c-xau)" }, { label: "∇f (risk uphill)", color: "var(--c-you)" }, { label: "∇g (return)", color: "var(--c-spx)" }] : [])]} />}
    >
      <Plot
        equalAspect
        xDomain={domain.x}
        yDomain={domain.y}
        xFormat={(v) => pct(v, 0)}
        yFormat={(v) => pct(v, 0)}
        xLabel="w₁: share in S&P 500"
        yLabel="w₂: share in gold"
        zeroLineX
        zeroLineY
        cursor="crosshair"
        onPointer={(d, px) => setHover({ w1: d.x, w2: d.y, px: px.x, py: px.y })}
        onLeave={() => setHover(null)}
        onClick={(d) => setProbe(projectOntoLine(k.mu, target, d.x, d.y)[0])}
        tooltip={
          hover && {
            x: hover.px,
            y: hover.py,
            content: (
              <div>
                w = ({hover.w1.toFixed(2)}, {hover.w2.toFixed(2)}, {(1 - hover.w1 - hover.w2).toFixed(2)})
                <div>risk σ = {pct(Math.sqrt(planeVariance(S, hover.w1, hover.w2)))}</div>
                <div>return = {pct(dot(fullWeights(hover.w1, hover.w2), k.mu))}</div>
              </div>
            ),
          }
        }
      >
        {({ x, y }) => {
          const sx = (c: number) => x(domain.x[0] + ((c - 0.5) * (domain.x[1] - domain.x[0])) / (GRID - 1));
          const sy = (c: number) => y(domain.y[0] + ((c - 0.5) * (domain.y[1] - domain.y[0])) / (GRID - 1));
          const path = geoPath(
            geoTransform({
              point(px, py) {
                this.stream.point(sx(px), sy(py));
              },
            }),
          );
          const arrow = (w1: number, w2: number, v: [number, number], color: string, len = 55) => {
            const L = Math.hypot(v[0], v[1]);
            const dx = (v[0] / L) * len;
            const dy = -(v[1] / L) * len; // screen y points down
            const x0 = x(w1);
            const y0 = y(w2);
            return (
              <g>
                <line x1={x0} y1={y0} x2={x0 + dx} y2={y0 + dy} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
                <polygon points={`${x0 + dx},${y0 + dy} ${x0 + dx - (dx * 0.22 + dy * 0.12)},${y0 + dy - (dy * 0.22 - dx * 0.12)} ${x0 + dx - (dx * 0.22 - dy * 0.12)},${y0 + dy - (dy * 0.22 + dx * 0.12)}`} fill={color} />
              </g>
            );
          };
          const xa = domain.x[0];
          const xb = domain.x[1];
          return (
            <>
              <defs>
                <clipPath id={`clip-${reveal}`}>
                  <rect x={x(domain.x[0])} y={y(domain.y[1])} width={x(domain.x[1]) - x(domain.x[0])} height={y(domain.y[0]) - y(domain.y[1])} />
                </clipPath>
              </defs>
              <g clipPath={`url(#clip-${reveal})`}>
                {/* The long-only triangle: w₁, w₂, w₃ ≥ 0 */}
                <polygon points={`${x(0)},${y(0)} ${x(1)},${y(0)} ${x(0)},${y(1)}`} fill="var(--surface-2)" stroke="var(--axis)" strokeDasharray="3 3" />
                {shapes.map((s, i) => (
                  <path key={i} d={path(s) ?? ""} fill="none" stroke="var(--c-neutral)" strokeWidth={1.2} opacity={0.8} />
                ))}
                {reveal && tangent.map((s, i) => <path key={i} d={path(s) ?? ""} fill="none" stroke="var(--c-xau)" strokeWidth={2.5} />)}
                <line x1={x(xa)} y1={y(lineW2(k.mu, target, xa))} x2={x(xb)} y2={y(lineW2(k.mu, target, xb))} stroke="var(--c-frontier)" strokeWidth={2.5} />
              </g>
              <text x={x(0.05)} y={y(0.05)} style={{ fontSize: 10 }}>no short-selling</text>
              {reveal && (
                <>
                  {arrow(opt.weights[0], opt.weights[1], planeGradient(S, opt.weights[0], opt.weights[1]), "var(--c-you)")}
                  {arrow(opt.weights[0], opt.weights[1], gg, "var(--c-spx)", 38)}
                  <circle cx={x(opt.weights[0])} cy={y(opt.weights[1])} r={6} fill="var(--c-xau)" stroke="var(--surface)" strokeWidth={2} />
                  <text className="label" x={x(opt.weights[0]) + 10} y={y(opt.weights[1]) + 18}>optimum</text>
                  {arrow(probe, w2p, planeGradient(S, probe, w2p), "var(--c-you)", 40)}
                  {arrow(probe, w2p, gg, "var(--c-spx)", 28)}
                </>
              )}
              <circle cx={x(probe)} cy={y(w2p)} r={7} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />
              <text className="label" x={x(probe) - 10} y={y(w2p) - 10} textAnchor="end">you</text>
            </>
          );
        }}
      </Plot>
    </Figure>
  );
}
