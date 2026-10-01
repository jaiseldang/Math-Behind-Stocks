"use client";
import { line } from "d3";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { TimeChart } from "@/components/charts/TimeChart";
import { WeightLines } from "@/components/charts/WeightLines";
import { PageHeader } from "@/components/pattern/Stages";
import { Eq } from "@/components/pattern/Tex";
import { useData } from "@/components/providers";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { exportCsv } from "@/lib/export";
import { useDownloadsAllowed } from "@/lib/target";
import { pct, texMatrixPlain, texNum } from "@/lib/format";
import { frontierVariance, optimalWeights } from "@/lib/math";
import { useModel } from "@/lib/useModel";

export default function WriteUpPage() {
  const { months, returnMonths, prices, stats, k, mvp, linear, zeros, asym } = useModel();
  const data = useData();
  const downloadsAllowed = useDownloadsAllowed();
  const band = zeros.noShortInterval;
  const at2 = optimalWeights(k, 0.02);
  const names = DEFAULT_ASSETS.map((a) => ASSETS[a].name);
  const retrieved = data.provenance?.map((p) => `${ASSETS[p.asset].name}: ${p.source} (${p.url}), retrieved ${p.retrievedAt.slice(0, 10)}`).join("; ") ?? "";

  const keyNumbers: (string | number)[][] = [
    ...DEFAULT_ASSETS.map((a, i) => [`Mean monthly return, ${names[i]}`, stats.means[i]]),
    ...DEFAULT_ASSETS.map((a, i) => [`Monthly SD, ${names[i]}`, stats.sds[i]]),
    ...DEFAULT_ASSETS.map((a, i) => [`Geometric monthly mean, ${names[i]}`, stats.geometricMeans[i]]),
    ["Correlation S&P 500–gold", stats.correlation[0][1]],
    ["Correlation S&P 500–Solana", stats.correlation[0][2]],
    ["Correlation gold–Solana", stats.correlation[1][2]],
    ["A", k.A], ["B", k.B], ["C", k.C], ["D", k.D],
    ["Minimum-variance return B/A", mvp.mu], ["Minimum-variance SD 1/√A", mvp.sd],
    ...DEFAULT_ASSETS.map((a, i) => [`Minimum-variance weight, ${names[i]}`, mvp.weights[i]]),
    ...DEFAULT_ASSETS.map((a, i) => [`g, ${names[i]}`, linear.g[i]]),
    ...DEFAULT_ASSETS.map((a, i) => [`h, ${names[i]}`, linear.h[i]]),
    ["No-short band, lower", band?.lower ?? "none"], ["No-short band, upper", band?.upper ?? "none"],
    ["Asymptote slope √(D/A)", asym.slope],
    ["λ₁ at μ* = 2%", at2.lambda1], ["λ₂ at μ* = 2%", at2.lambda2],
    ...DEFAULT_ASSETS.map((a, i) => [`Weight at μ* = 2%, ${names[i]}`, at2.weights[i]]),
    ["SD at μ* = 2%", at2.sd],
  ];

  const equations: [string, string][] = [
    ["Simple return", "R_t = \\frac{P_t}{P_{t-1}} - 1"],
    ["Sample covariance", "\\sigma_{ij} = \\frac{1}{n-1}\\sum_{t=1}^{n}(R_{i,t}-\\bar R_i)(R_{j,t}-\\bar R_j)"],
    ["Portfolio variance", "\\sigma_p^2 = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w"],
    ["Lagrangian", "L = \\mathbf w^{\\mathsf T}\\Sigma\\mathbf w - \\lambda_1(\\mathbf 1^{\\mathsf T}\\mathbf w - 1) - \\lambda_2(\\boldsymbol\\mu^{\\mathsf T}\\mathbf w - \\mu^*)"],
    ["First-order condition", "2\\Sigma\\mathbf w = \\lambda_1\\mathbf 1 + \\lambda_2\\boldsymbol\\mu"],
    ["Constants", "A = \\mathbf 1^{\\mathsf T}\\Sigma^{-1}\\mathbf 1,\\; B = \\mathbf 1^{\\mathsf T}\\Sigma^{-1}\\boldsymbol\\mu,\\; C = \\boldsymbol\\mu^{\\mathsf T}\\Sigma^{-1}\\boldsymbol\\mu,\\; D = AC - B^2"],
    ["Multipliers", "\\lambda_1 = \\frac{2(C - B\\mu^*)}{D},\\qquad \\lambda_2 = \\frac{2(A\\mu^* - B)}{D}"],
    ["Linear weights", "\\mathbf w(\\mu^*) = \\mathbf g + \\mathbf h\\mu^*,\\quad \\mathbf g = \\frac{C\\Sigma^{-1}\\mathbf 1 - B\\Sigma^{-1}\\boldsymbol\\mu}{D},\\quad \\mathbf h = \\frac{A\\Sigma^{-1}\\boldsymbol\\mu - B\\Sigma^{-1}\\mathbf 1}{D}"],
    ["Frontier", "\\sigma^2(\\mu^*) = \\frac{A\\mu^{*2} - 2B\\mu^* + C}{D}"],
    ["Asymptotes", "\\mu = \\frac BA \\pm \\sqrt{\\frac DA}\\,\\sigma"],
    ["Covariance matrix (data)", `\\Sigma = ${texMatrixPlain(stats.Sigma, 4)}`],
    ["Inverse (data)", `\\Sigma^{-1} = ${texMatrixPlain(k.SigmaInv, 5)}`],
    ["No-short-selling interval (data)", band ? `\\mu^* \\in [${texNum(band.lower, 5)},\\ ${texNum(band.upper, 5)}]` : "\\text{none}"],
  ];

  const mus = Array.from({ length: 121 }, (_, i) => 0.005 + i * 0.00025);

  return (
    <>
      <PageHeader
        n={10}
        title="For my write-up"
        lead={
          downloadsAllowed
            ? "Everything you need to build the IA document. Every chart on the site has PNG, SVG and CSV buttons; every equation has a Copy LaTeX button. Each export carries a caption with the data source and date range."
            : "Everything you need to build the IA document. Every equation has a Copy LaTeX button, and every chart has a Table view you can select and copy. Saving files isn't available in this view."
        }
      />

      <section className="stage">
        <h2>Citing the data</h2>
        <p className="note" style={{ marginBottom: 6 }}>{data.sourceNote}</p>
        <p className="note">{retrieved}</p>
        <p className="note" style={{ marginBottom: 0 }}>
          Method: monthly {data.method === "average" ? "averages of the available closes" : "month-end closes"}; simple returns R = Pₜ/Pₜ₋₁ − 1; sample statistics with divisor n − 1 (n = {stats.returns[0].length}).
          Computed with Portfolio Explorer (hand-written TypeScript; source code in the repository).
        </p>
      </section>

      <section className="stage">
        <div className="figure-head">
          <h2 style={{ margin: 0 }}>Key numbers</h2>
          {downloadsAllowed && <button className="btn" onClick={() => exportCsv(["Quantity", "Value"], keyNumbers, "key-numbers", data.sourceNote)}>Download CSV</button>}
        </div>
        <div className="table-wrap" style={{ maxHeight: 380, overflowY: "auto", marginTop: 8 }} tabIndex={0} role="region" aria-label="Key numbers table">
          <table className="data">
            <thead><tr><th>Quantity</th><th>Value</th></tr></thead>
            <tbody>{keyNumbers.map(([q, v]) => <tr key={String(q)}><td>{q}</td><td>{typeof v === "number" ? Number(v.toPrecision(6)) : v}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="stage">
        <h2>Key equations</h2>
        {equations.map(([label, tex]) => (
          <div key={label} style={{ marginBottom: 6 }}>
            <div className="note">{label}</div>
            <Eq label={label}>{tex}</Eq>
          </div>
        ))}
      </section>

      <h2 style={{ marginTop: 32 }}>Key charts</h2>
      <Figure
        title="Monthly prices, indexed to 100"
        alt="Indexed monthly prices of the S&P 500, gold and Solana."
        table={{ header: ["Month", ...names], rows: months.map((m, t) => [m, ...prices.map((p) => p[t])]) }}
        note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
      >
        <TimeChart months={months} yLog yFormat={(v) => String(Math.round(v))} yLabel="Index (log scale)" series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: prices[i].map((v) => (100 * v) / prices[i][0]) }))} />
      </Figure>

      <Figure
        title="Monthly returns"
        alt="Monthly simple returns of the three assets."
        table={{ header: ["Month", ...names], rows: returnMonths.map((m, t) => [m, ...stats.returns.map((r) => r[t])]) }}
        note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
      >
        <TimeChart months={returnMonths} zeroLine yFormat={(v) => pct(v, 0)} yLabel="Return" series={DEFAULT_ASSETS.map((a, i) => ({ id: a, name: ASSETS[a].name, color: ASSETS[a].color, values: stats.returns[i] }))} />
      </Figure>

      <Figure
        title="Optimal weights against the target return, with the no-short-selling band"
        alt={`Straight-line weights; no-short band ${band ? `${pct(band.lower, 3)} to ${pct(band.upper, 3)}` : "none"}.`}
        table={{ header: ["μ*", ...names], rows: mus.filter((_, i) => i % 4 === 0).map((m) => [m, ...linear.g.map((g, i) => g + linear.h[i] * m)]) }}
        note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
      >
        <WeightLines g={linear.g} h={linear.h} from={0.005} to={0.035} crossings={zeros.crossings} band={band} />
      </Figure>

      <Figure
        title="Minimum-variance frontier"
        alt={`Frontier with vertex at σ = ${pct(mvp.sd)}, μ = ${pct(mvp.mu)}.`}
        table={{ header: ["μ*", "σ"], rows: mus.filter((_, i) => i % 4 === 0).map((m) => [m, Math.sqrt(frontierVariance(k, m))]) }}
      >
        <Plot xDomain={[0, 0.1]} yDomain={[0.005, 0.035]} xFormat={(v) => pct(v, 0)} yFormat={(v) => pct(v, 1)} xLabel="Risk σ (monthly)" yLabel="Target return μ*">
          {({ x, y }) => (
            <>
              {band && <path d={line<number>().x((m) => x(Math.sqrt(frontierVariance(k, m)))).y((m) => y(m))(mus.filter((m) => m >= band.lower && m <= band.upper)) ?? ""} stroke="var(--good)" strokeWidth={8} opacity={0.3} fill="none" />}
              <path d={line<number>().x((m) => x(Math.sqrt(frontierVariance(k, m)))).y((m) => y(m))(mus) ?? ""} stroke="var(--c-frontier)" strokeWidth={2.5} fill="none" />
              {DEFAULT_ASSETS.map((a, i) => stats.sds[i] < 0.1 && (
                <g key={a}>
                  <circle cx={x(stats.sds[i])} cy={y(stats.means[i])} r={6} fill={ASSETS[a].color} stroke="var(--surface)" strokeWidth={2} />
                  <text className="label" x={x(stats.sds[i]) + 9} y={y(stats.means[i])} dy="0.32em">{ASSETS[a].name}</text>
                </g>
              ))}
              <circle cx={x(mvp.sd)} cy={y(mvp.mu)} r={5} fill="var(--c-frontier)" />
            </>
          )}
        </Plot>
      </Figure>
    </>
  );
}
