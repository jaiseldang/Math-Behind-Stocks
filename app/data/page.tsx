"use client";
import { useEffect, useMemo, useState } from "react";
import { Figure } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { Check, Experiment, Finding, GuessChoice, Intuition, MathSteps, PageHeader, Question } from "@/components/pattern/Stages";
import { M } from "@/components/pattern/Tex";
import { useData } from "@/components/providers";
import { Segmented, Slider } from "@/components/ui/Slider";
import { ASSETS, DEFAULT_ASSETS, type AssetId } from "@/lib/assets";
import { NYSE_HOLIDAYS, tradingDays, weekdayCount } from "@/lib/data/calendar";
import { SNAPSHOT } from "@/lib/data/snapshot";
import { monthLabel, pct } from "@/lib/format";
import { averagingExperiment } from "@/lib/math";

interface StatsBody {
  sd: Record<AssetId, number>;
  mean: Record<AssetId, number>;
  n: number;
  provenance: { fallback: boolean; warnings: string[]; source: string; method: string };
}

export default function DataPage() {
  const data = useData();
  const [perMonth, setPerMonth] = useState(21);
  const sim = useMemo(() => averagingExperiment(perMonth, 4000), [perMonth]);
  const [calMonth, setCalMonth] = useState("2024-01");
  const [live, setLive] = useState<{ average?: StatsBody; close?: StatsBody; error?: string } | null>(null);

  const loadLive = () => {
    setLive({});
    Promise.all(
      (["average", "close"] as const).map((m) =>
        fetch(`/api/stats?source=live&method=${m}`).then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          return b as StatsBody;
        }),
      ),
    )
      .then(([average, close]) => setLive({ average, close }))
      .catch((e) => setLive({ error: e.message }));
  };

  // Check: Solana's snapshot average × (number of Wednesdays) should be a whole number of cents.
  const wednesdayCheck = SNAPSHOT.map((r) => {
    const n = weekdayCount(r.month, 3);
    const total = r.solana * n;
    return { month: r.month, n, total, ok: Math.abs(total * 100 - Math.round(total * 100)) < 1e-6 };
  });
  const allOk = wednesdayCheck.every((c) => c.ok);
  const liveUsable = live?.average && !live.average.provenance.fallback && live.close && !live.close.provenance.fallback;

  return (
    <>
      <PageHeader n={2} title="Data & provenance" lead="Where every number comes from, and the small choices that change them." />

      <Question>If two people download “the S&amp;P 500 price for March”, will they get the same number?</Question>

      <GuessChoice
        id="data-average-vs-close"
        prompt="A month's price can be the average of all its daily closes, or just the last close. Which gives smaller month-to-month swings (standard deviation of returns)?"
        options={["The monthly average", "The month-end close", "They give the same swings"]}
      />

      <Intuition>
        <p>
          Think of a month as a bucket of days. You can describe the bucket by a photo of its <strong>last day</strong> (month-end close), or by a blurred
          long-exposure photo of <strong>all its days</strong> (monthly average).
        </p>
        <p style={{ marginBottom: 0 }}>
          A blurred photo hides sudden jumps. So averaging should make each month look more like its neighbours. Consecutive averages even share some of the same days&apos; moves.
        </p>
      </Intuition>

      <MathSteps
        steps={[
          {
            tex: "P^{\\text{avg}}_m = \\frac{1}{N_m}\\sum_{d \\in m} P_d \\qquad P^{\\text{close}}_m = P_{\\text{last day of } m}",
            why: <>The two definitions. <M>{"N_m"}</M> is the number of observations in month <M>m</M>: trading days for the S&amp;P 500, weekly closes for Solana, 1 for gold.</>,
            words: "Average price = add up every price in the month and divide by how many there are. Close = the last price of the month.",
          },
          {
            tex: "\\text{Var}\\left(\\Delta P^{\\text{close}}\\right) = N\\sigma_d^2",
            why: "If prices follow a random walk with daily step variance σ_d², a month-end-to-month-end change is the sum of N independent daily steps.",
            words: "Month-end changes add up N independent daily moves.",
          },
          {
            tex: "\\text{Var}\\left(\\Delta P^{\\text{avg}}\\right) = \\sigma_d^2\\,\\frac{2N^2+1}{3N} \\approx \\tfrac{2}{3}\\,N\\sigma_d^2",
            why: "Working (1960): in the change between two monthly averages, days near the month boundary count fully, but days early in the first month or late in the second only count partially. Adding up the weights² gives (2N²+1)/(3N).",
            words: "Changes in monthly averages have only about two-thirds of the variance of month-end changes.",
          },
          {
            tex: "\\frac{\\sigma^{\\text{avg}}}{\\sigma^{\\text{close}}} \\approx \\sqrt{\\tfrac23} \\approx 0.816, \\qquad \\rho_1\\left(\\Delta P^{\\text{avg}}\\right) \\approx \\tfrac14",
            why: "Taking square roots: averaging cuts measured risk by about 18%, and makes consecutive monthly returns correlated (they share days).",
            words: "Averaging makes risk look about 18% smaller and makes one month's return partly predict the next.",
          },
        ]}
      />

      <Experiment title="Experiment A: simulate it">
        <p>A computer-generated random-walk price, {sim ? "4,000" : ""} months long. Choose how many observations each month has, then compare the two methods.</p>
        <Slider label="Observations per month N" value={perMonth} min={1} max={31} step={1} onChange={setPerMonth} format={(v) => `${v}${v === 1 ? " (close only)" : v === 4 ? " (≈ weekly)" : v === 21 ? " (≈ trading days)" : v === 30 ? " (≈ every day)" : ""}`} />
        <div className="stats">
          <div className="stat"><div className="label">SD, month-end close</div><div className="value">{pct(sim.sdClose)}</div></div>
          <div className="stat"><div className="label">SD, monthly average</div><div className="value">{pct(sim.sdAvg)}</div></div>
          <div className="stat"><div className="label">Ratio (simulated)</div><div className="value">{sim.ratio.toFixed(3)}</div><div className="sub">theory √((2N²+1)/3N²) = {sim.theoryRatio.toFixed(3)}</div></div>
          <div className="stat"><div className="label">Lag-1 autocorrelation</div><div className="value">{sim.autocorrAvg.toFixed(2)}</div><div className="sub">average method (close: {sim.autocorrClose.toFixed(2)})</div></div>
        </div>
      </Experiment>

      <Experiment title="Experiment B: the real data, both ways">
        <p>
          This asks the API for live data twice, once with <code>method=average</code> and once with <code>method=close</code>. The IA snapshot only stores averages,
          so this needs the live sources.
        </p>
        <button className="btn primary" onClick={loadLive}>Fetch live statistics both ways</button>
        {live && !live.average && !live.error && <p className="note">Loading…</p>}
        {live?.error && <div className="banner">Could not reach the API: {live.error}</div>}
        {live?.average && live.close && (
          <>
            {!liveUsable && (
              <div className="banner">
                At least one live source is unavailable, so fallback data is mixed in and the comparison isn&apos;t meaningful:
                <ul>{[...new Set([...live.average.provenance.warnings, ...live.close.provenance.warnings])].map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Asset</th><th>SD (average)</th><th>SD (close)</th><th>Ratio</th><th>Mean (average)</th><th>Mean (close)</th></tr></thead>
                <tbody>
                  {DEFAULT_ASSETS.map((a) => (
                    <tr key={a}>
                      <td><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}</td>
                      <td>{pct(live.average!.sd[a])}</td>
                      <td>{pct(live.close!.sd[a])}</td>
                      <td>{(live.average!.sd[a] / live.close!.sd[a]).toFixed(3)}</td>
                      <td>{pct(live.average!.mean[a])}</td>
                      <td>{pct(live.close!.mean[a])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Gold only exists as monthly averages, so its two columns are identical by construction.</p>
          </>
        )}
      </Experiment>

      <Experiment title="Experiment C: lining up the calendars">
        <p>
          The S&amp;P 500 trades on weekdays except US holidays. Solana trades every day. Gold arrives as one monthly number. So everything is lined up on{" "}
          <strong>calendar months</strong>: each asset is averaged over its <em>own</em> observations in that month.
        </p>
        <label className="note">
          Month:{" "}
          <select value={calMonth} onChange={(e) => setCalMonth(e.target.value)}>
            {SNAPSHOT.map((r) => <option key={r.month} value={r.month}>{monthLabel(r.month)}</option>)}
          </select>
        </label>
        <CalendarStrip month={calMonth} />
      </Experiment>

      <Finding
        headline={<>Averaging smooths: monthly averages give about {pct(1 - Math.sqrt(2 / 3), 0)} lower standard deviations than month-end closes, and make consecutive returns correlated (ρ ≈ 0.25).</>}
        guessId="data-average-vs-close"
        compare={(g) => (g.value === 0 ? "Correct: the blur hides jumps." : "The simulation says otherwise: the average has the smaller swings.")}
      >
        <p>
          So two people <em>can</em> get different numbers for “March”. The IA uses monthly averages (the default here, and the only thing the snapshot stores).
          That means its risk figures are somewhat smaller than month-end figures would be. The optimal <em>weights</em> depend on the ratios between risks, so they move less.
          This is noted on the <a href="/limitations">Limitations</a> page.
        </p>
      </Finding>

      <Check>
        <p>
          <strong>How do we know how the IA counted Solana weeks?</strong> Kraken prices have 2 decimal places. So if a month&apos;s average came from <M>n</M> weekly closes,
          then <M>{"n \\times \\text{average}"}</M> must be a whole number of cents. Dating each weekly candle by its <strong>closing Wednesday</strong> works for{" "}
          {wednesdayCheck.filter((c) => c.ok).length}/{wednesdayCheck.length} months. {allOk && "No other weekday fits all months, so this is how the live pipeline dates weekly candles too."}
        </p>
        <details>
          <summary>Show the check for every month</summary>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Month</th><th>Average</th><th>Wednesdays n</th><th>n × average</th><th>Whole cents?</th></tr></thead>
              <tbody>
                {wednesdayCheck.map((c) => (
                  <tr key={c.month}><td>{c.month}</td><td>{SNAPSHOT.find((r) => r.month === c.month)!.solana}</td><td>{c.n}</td><td>{c.total.toFixed(4)}</td><td>{c.ok ? "✓" : "✗"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Check>

      <h2 style={{ marginTop: 32 }}>Sources in use right now</h2>
      <div className="note" style={{ marginBottom: 12 }}>
        Currently showing: <strong>{data.source === "snapshot" ? "the IA snapshot" : "live data"}</strong> ({data.method === "average" ? "monthly averages" : "month-end closes"}).
        Switch with the sidebar.{" "}
        <Segmented label="Resampling method" value={data.method} onChange={data.setMethod} options={[{ value: "average", label: "Monthly average" }, { value: "close", label: "Month-end close" }]} />
      </div>
      <div className="grid-2">
        {(data.provenance ?? []).map((p) => (
          <div className="stage" key={p.asset} style={{ margin: 0 }}>
            <h3><span className="swatch" style={{ background: ASSETS[p.asset].color }} />{ASSETS[p.asset].name}</h3>
            <p className="note" style={{ marginBottom: 4 }}>{p.source}</p>
            <p className="note" style={{ marginBottom: 4, wordBreak: "break-all" }}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a></p>
            <p className="note" style={{ marginBottom: 4 }}>Retrieved: {p.retrievedAt.replace("T", " ").slice(0, 16)} UTC · cache: {p.cache}{p.fallback ? " · fallback" : ""}</p>
            <p className="note" style={{ marginBottom: 0 }}>{p.datingRule}</p>
          </div>
        ))}
      </div>
      {data.provenance && (
        <Figure
          title="Raw observations used per month"
          alt="Bar chart of the number of raw observations averaged in each month for each asset."
          table={{ header: ["Month", ...DEFAULT_ASSETS.map((a) => ASSETS[a].name)], rows: data.months.map((m) => [m, ...data.provenance!.map((p) => p.observationsPerMonth[m] ?? 0)]) }}
        >
          <ObsBars months={data.months} counts={data.provenance.map((p) => data.months.map((m) => p.observationsPerMonth[m] ?? 0))} />
        </Figure>
      )}
    </>
  );
}

function ObsBars({ months, counts }: { months: string[]; counts: number[][] }) {
  const max = Math.max(...counts.flat(), 1);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  return (
    <Plot
      height={220}
      xDomain={[-0.5, months.length - 0.5]}
      yDomain={[0, max * 1.1]}
      xTickValues={months.map((m, i) => (m.endsWith("-01") ? i : -1)).filter((i) => i >= 0)}
      xFormat={(i) => months[Math.round(i)]?.slice(0, 4) ?? ""}
      yFormat={(v) => String(v)}
      yLabel="Observations"
      onPointer={(d, px) => setHover({ i: Math.round(d.x), x: px.x, y: px.y })}
      onLeave={() => setHover(null)}
      tooltip={hover && months[hover.i] ? { x: hover.x, y: hover.y, content: <div><strong>{monthLabel(months[hover.i])}</strong>{DEFAULT_ASSETS.map((a, k) => <div key={a}>{ASSETS[a].name}: {counts[k][hover.i]}</div>)}</div> } : null}
    >
      {({ x, y }) => {
        const band = (x(1) - x(0)) * 0.8;
        const bw = Math.max(1, band / 3 - 1);
        return counts.map((c, k) =>
          c.map((v, i) => (
            <rect key={`${k}-${i}`} x={x(i) - band / 2 + k * (bw + 1)} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} rx={Math.min(2, bw / 2)} fill={ASSETS[DEFAULT_ASSETS[k]].color} />
          )),
        );
      }}
    </Plot>
  );
}

function CalendarStrip({ month }: { month: string }) {
  const [y, m] = month.split("-").map(Number);
  const days: Date[] = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d = new Date(d.getTime() + 86400000)) days.push(d);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const rows: { label: string; color: string; on: (d: Date) => boolean; count: number }[] = [
    { label: "S&P 500 (trading days)", color: ASSETS.SPX.color, on: (d) => d.getUTCDay() % 6 !== 0 && !NYSE_HOLIDAYS.has(iso(d)), count: tradingDays(month) },
    { label: "Solana (daily, every day)", color: ASSETS.SOL.color, on: () => true, count: days.length },
    { label: "Solana (weekly closes, Wed)", color: ASSETS.SOL.color, on: (d) => d.getUTCDay() === 3, count: weekdayCount(month, 3) },
    { label: "Gold (one monthly figure)", color: ASSETS.XAU.color, on: (d) => d.getUTCDate() === 1, count: 1 },
  ];
  const cell = 18;
  const labelW = 190;
  const W = labelW + days.length * (cell + 2) + 40;
  return (
    <div className="chart-wrap" style={{ overflowX: "auto" }}>
      <svg className="chart" width={W} height={rows.length * 26 + 24} viewBox={`0 0 ${W} ${rows.length * 26 + 24}`} style={{ width: W, maxWidth: "none" }} role="img" aria-label={`Calendar of ${monthLabel(month)} showing which days each series has an observation.`}>
        {days.map((d, i) => (
          <text key={i} x={labelW + i * (cell + 2) + cell / 2} y={12} textAnchor="middle" style={{ fontSize: 9, fill: d.getUTCDay() % 6 === 0 ? "var(--bad)" : undefined }}>
            {d.getUTCDate()}
          </text>
        ))}
        {rows.map((r, k) => (
          <g key={r.label} transform={`translate(0 ${20 + k * 26})`}>
            <text x={0} y={13} style={{ fontSize: 11, fill: "var(--ink-2)" }}>{r.label}</text>
            {days.map((d, i) => (
              <rect key={i} x={labelW + i * (cell + 2)} y={0} width={cell} height={cell} rx={3} fill={r.on(d) ? r.color : "var(--surface-2)"} stroke="var(--border)">
                <title>{`${iso(d)}: ${r.on(d) ? "observation" : "none"}`}</title>
              </rect>
            ))}
            <text x={labelW + days.length * (cell + 2) + 6} y={13} className="label">{r.count}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
