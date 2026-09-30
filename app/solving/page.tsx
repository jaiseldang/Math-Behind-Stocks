"use client";
import { useState } from "react";
import { Check, Experiment, Finding, GuessSlider, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { Eq, M } from "@/components/pattern/Tex";
import { Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct, sig, texAugmented, texMatrixPlain, texNum, usd } from "@/lib/format";
import { checkPortfolio, determinant, dot, frontierVariance, identity, inverse, multiply, optimalWeights, sum } from "@/lib/math";
import { useModel } from "@/lib/useModel";

export default function SolvingPage() {
  const { k, stats } = useModel();
  const [target, setTarget] = useState(0.02);
  const [amount, setAmount] = useState(1000);
  const [step, setStep] = useState(0);
  const S = stats.Sigma;
  const mu = stats.means;
  const inv = inverse(S, true);
  const p = optimalWeights(k, target);
  const checks = checkPortfolio(k, p);
  const at2 = optimalWeights(k, 0.02);
  const n = (x: number, sf = 5) => texNum(x, sf);
  const ops = inv.steps;
  const current = step === 0 ? S.map((r, i) => [...r, ...identity(3)[i]]) : ops[step - 1].augmented;
  const SSi = multiply(S, inv.inverse);

  return (
    <>
      <PageHeader n={7} title="Solving it" lead="The full Lagrange solution with the real numbers, every step shown." />

      <Question>Exactly how should $1,000 be split to earn 2% a month with the least possible risk?</Question>

      <GuessSlider id="solving-sol-dollars" prompt="How many dollars of the $1,000 do you think go into Solana, the asset with by far the highest average return?" min={0} max={300} step={1} initial={100} format={(v) => usd(v, 0)} />

      <Intuition>
        <p>
          Page 6 turned &ldquo;find the lowest point&rdquo; into &ldquo;make two arrows parallel&rdquo;. That condition gives 3 equations (one per asset), plus the 2 constraints: 5 equations
          for 5 unknowns (w₁, w₂, w₃, λ₁, λ₂).
        </p>
        <p style={{ marginBottom: 0 }}>
          The trick is to solve for <strong>w in terms of the λs</strong> first. Then only a 2×2 system is left, and it involves just four numbers, called A, B, C and D.
        </p>
      </Intuition>

      <MathSteps
        stacked
        steps={[
          { tex: `\\boldsymbol\\mu = \\begin{pmatrix}${mu.map((x) => n(x)).join("\\\\")}\\end{pmatrix},\\quad \\Sigma = ${texMatrixPlain(S, 4)}`, why: "The inputs: monthly mean returns and the covariance matrix (divide by n − 1) from page 4.", words: "Start from the average returns and the table of variances and covariances." },
          { tex: "L(\\mathbf w,\\lambda_1,\\lambda_2) = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w - \\lambda_1(\\mathbf 1^{\\mathsf T}\\mathbf w - 1) - \\lambda_2(\\boldsymbol\\mu^{\\mathsf T}\\mathbf w - \\mu^*)", why: "The Lagrangian: the thing to minimise, minus a multiplier times each constraint (written as “… = 0”).", words: "Combine risk and both rules into one expression, using two helper numbers λ₁ and λ₂." },
          { tex: "\\frac{\\partial L}{\\partial \\mathbf w} = 2\\Sigma\\mathbf w - \\lambda_1\\mathbf 1 - \\lambda_2\\boldsymbol\\mu = \\mathbf 0", why: "Differentiate with respect to each weight. The derivative of wᵀΣw is 2Σw (Σ is symmetric), like d/dx(ax²) = 2ax. This is ∇f = λ₁∇g₁ + λ₂∇g₂.", words: "Set the slope in every direction to zero." },
          { tex: "\\mathbf w = \\tfrac12\\Sigma^{-1}(\\lambda_1\\mathbf 1 + \\lambda_2\\boldsymbol\\mu)", why: "Multiply both sides by Σ⁻¹ (it exists because Σ is positive definite). The inverse is computed step by step in the experiment below.", words: "Undo the multiplication by the covariance table to get the weights." },
          { tex: `\\Sigma^{-1} = ${texMatrixPlain(k.SigmaInv, 5)},\\quad \\det\\Sigma = ${n(determinant(S), 4)}`, why: "Gauss–Jordan elimination (below). det Σ > 0 is one sign that Σ is invertible.", words: "The inverse table." },
          { tex: "\\mathbf 1^{\\mathsf T}\\mathbf w = 1 \\Rightarrow \\tfrac12(A\\lambda_1 + B\\lambda_2) = 1, \\qquad \\boldsymbol\\mu^{\\mathsf T}\\mathbf w = \\mu^* \\Rightarrow \\tfrac12(B\\lambda_1 + C\\lambda_2) = \\mu^*", why: "Substitute w into the two constraints. The same combinations of Σ⁻¹ keep appearing, so name them A, B, C.", words: "Put the weights back into the two rules; four special numbers appear." },
          { tex: `A = \\mathbf 1^{\\mathsf T}\\Sigma^{-1}\\mathbf 1 = ${n(k.A)},\\;\\; B = \\mathbf 1^{\\mathsf T}\\Sigma^{-1}\\boldsymbol\\mu = ${n(k.B)},\\;\\; C = \\boldsymbol\\mu^{\\mathsf T}\\Sigma^{-1}\\boldsymbol\\mu = ${n(k.C)},\\;\\; D = AC-B^2 = ${n(k.D)}`, why: "A is the sum of all entries of Σ⁻¹, B weights them by μ, C by μ twice. D is the determinant of the 2×2 system, so D > 0 means it has a unique solution.", words: "Compute the four numbers A, B, C and D." },
          { tex: `\\lambda_1 = \\frac{2(C - B\\mu^*)}{D} = ${n(p.lambda1, 4)},\\qquad \\lambda_2 = \\frac{2(A\\mu^* - B)}{D} = ${n(p.lambda2)}`, why: `Solve the 2×2 system (Cramer's rule), here with μ* = ${pct(target)}.`, words: "Solve two equations for the two helper numbers." },
          { tex: `\\mathbf w = \\tfrac12\\left(\\lambda_1\\Sigma^{-1}\\mathbf 1 + \\lambda_2\\Sigma^{-1}\\boldsymbol\\mu\\right) = \\begin{pmatrix}${p.weights.map((x) => n(x)).join("\\\\")}\\end{pmatrix}`, why: "Substitute the λs back. These are the minimum-risk weights for this target.", words: "Put them back to get the weights." },
          { tex: `\\sigma^2 = \\frac{A\\mu^{*2} - 2B\\mu^* + C}{D} = ${n(frontierVariance(k, target))},\\qquad \\sigma = ${n(p.sd)}`, why: "σ² = wᵀΣw simplifies to this formula (proved on page 8, investigation 3).", words: "The risk of that portfolio." },
        ]}
      />

      <Experiment title="Experiment A: invert Σ by hand (Gauss–Jordan)">
        <p>
          Write <M>{"[\\,\\Sigma \\mid I\\,]"}</M> and use row operations to turn the left half into <M>I</M>. The right half then becomes <M>{"\\Sigma^{-1}"}</M>.
          The largest available entry is always used as the pivot (partial pivoting), which keeps rounding errors small.
        </p>
        <Eq>{texAugmented(current, 3, 4)}</Eq>
        <p aria-live="polite">
          {step === 0 ? (
            <strong>Start: [Σ | I]</strong>
          ) : (
            <>
              <strong>Step {step} of {ops.length}: <M>{ops[step - 1].latex}</M></strong>
              <span className="note"> ({ops[step - 1].reason})</span>
            </>
          )}
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => setStep(0)} disabled={step === 0}>⏮ Start</button>
          <button className="btn" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</button>
          <button className="btn primary" onClick={() => setStep(Math.min(ops.length, step + 1))} disabled={step === ops.length}>Next row operation →</button>
          <button className="btn" onClick={() => setStep(ops.length)} disabled={step === ops.length}>Finish ⏭</button>
        </div>
        <details>
          <summary>List every row operation</summary>
          <ol>{ops.map((o, i) => <li key={i}><M>{o.latex}</M> <span className="note">({o.reason})</span></li>)}</ol>
        </details>
        <p style={{ marginTop: 12 }}>Check that it really is the inverse:</p>
        <Eq>{`\\Sigma\\,\\Sigma^{-1} = ${texMatrixPlain(SSi.map((r) => r.map((v) => (Math.abs(v) < 1e-12 ? 0 : v))), 6)} = I`}</Eq>
      </Experiment>

      <Experiment title="Experiment B: your target, your money">
        <Slider label={<>Target <M>{"\\mu^*"}</M> per month</>} value={target} min={0.005} max={0.05} step={0.0005} onChange={setTarget} format={(v) => pct(v)} />
        <div className="slider">
          <label htmlFor="amount">Amount to invest</label>
          <input id="amount" type="number" min={1} step={100} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} style={{ width: "100%" }} />
          <output htmlFor="amount">{usd(amount, 0)}</output>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Asset</th><th>Weight</th><th>Dollars</th><th></th></tr></thead>
            <tbody>
              {DEFAULT_ASSETS.map((a, i) => (
                <tr key={a}>
                  <td><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}</td>
                  <td>{pct(p.weights[i], 3)}</td>
                  <td className={p.weights[i] < 0 ? "neg" : undefined}>{usd(p.weights[i] * amount)}</td>
                  <td className="note">{p.weights[i] < 0 ? "short: borrow and sell" : ""}</td>
                </tr>
              ))}
              <tr><td><strong>Total</strong></td><td>{pct(sum(p.weights), 3)}</td><td>{usd(sum(p.weights) * amount)}</td><td /></tr>
            </tbody>
          </table>
        </div>
        <div className="stats">
          <div className="stat"><div className="label">Expected return</div><div className="value">{pct(dot(p.weights, mu))}</div><div className="sub">{usd(dot(p.weights, mu) * amount)} a month</div></div>
          <div className="stat"><div className="label">Risk σ (minimum possible)</div><div className="value">{pct(p.sd, 3)}</div><div className="sub">±{usd(p.sd * amount)} in a typical month</div></div>
          <div className="stat"><div className="label">λ₁, λ₂</div><div className="value" style={{ fontSize: "1rem" }}>{sig(p.lambda1, 3)}, {sig(p.lambda2, 4)}</div></div>
        </div>
      </Experiment>

      <Finding
        headline={
          <>
            For 2% a month, put {usd(at2.weights[0] * 1000)} in the S&amp;P 500, {usd(at2.weights[1] * 1000)} in gold and only {usd(at2.weights[2] * 1000)} in Solana, for a minimum risk of {pct(at2.sd, 3)} a month.
          </>
        }
        guessId="solving-sol-dollars"
        compare={(g) => `The answer is ${usd(at2.weights[2] * 1000)}; you were ${usd(Math.abs(Number(g.value) - at2.weights[2] * 1000))} ${Number(g.value) > at2.weights[2] * 1000 ? "over" : "under"}.`}
      >
        <p>
          Solana&apos;s huge average return barely matters here: its risk is so large that a tiny amount already contributes all the extra return that is needed.
          The <a href="/explore">next page</a> explores how this answer changes with the target.
        </p>
      </Finding>

      <Check>
        <p>Three independent checks on the answer for μ* = {pct(target)}:</p>
        <div className="stats">
          <div className="stat"><div className="label">Weights sum to 1</div><div className="value">{checks.weightsSumToOne.ok ? "✓" : "✗"} {checks.weightsSumToOne.value.toFixed(10)}</div></div>
          <div className="stat"><div className="label">wᵀμ equals the target</div><div className="value">{checks.hitsTarget.ok ? "✓" : "✗"} {pct(checks.hitsTarget.value, 6)}</div></div>
          <div className="stat"><div className="label">wᵀΣw directly</div><div className="value small">{checks.varianceMatchesFrontier.direct.toExponential(8)}</div></div>
          <div className="stat"><div className="label">(Aμ*² − 2Bμ* + C)/D</div><div className="value small">{checks.varianceMatchesFrontier.formula.toExponential(8)}</div></div>
        </div>
      </Check>
    </>
  );
}
