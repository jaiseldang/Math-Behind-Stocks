"use client";
/**
 * Data page, Experiment D: the same 37 months from two providers (the IA's
 * FRED / World Bank / Kraken numbers and TradingView), and how much the
 * research question's answer moves between them.
 */
import { useEffect, useMemo, useState } from "react";
import { Figure, Legend } from "@/components/charts/Figure";
import { Plot } from "@/components/charts/Plot";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { SNAPSHOT } from "@/lib/data/snapshot";
import { exportCsv } from "@/lib/export";
import { monthLabel, pct, spct } from "@/lib/format";
import { analysePrices, lagrangeConstants, minimumVariancePortfolio, zeroCrossings } from "@/lib/math";
import { useDownloadsAllowed } from "@/lib/target";

/** The IA's Sep 2023 S&P 500 value is the 1 Sep close; the month's 20 daily closes average 4409.10. */
export const SEP_2023_SPX_AVERAGE = 4409.1;

const FROM = SNAPSHOT[0].month;
const TO = SNAPSHOT.at(-1)!.month;
const CAPTION = `Sources: IA snapshot (FRED/Shiller, World Bank, Kraken) and TradingView SP:SPX, TVC:GOLD, KRAKEN:SOLUSD (bundled, retrieved 2026-10-07); ${FROM} to ${TO}.`;

interface Prices {
  months: string[];
  prices: number[][];
}

/** The numbers that answer the research question, for one dataset. */
function summarise(prices: number[][]) {
  const stats = analysePrices(prices);
  const k = lagrangeConstants(stats.Sigma, stats.means);
  const mvp = minimumVariancePortfolio(k);
  return { sigma: Math.sqrt(mvp.variance), weights: mvp.weights, band: zeroCrossings(k).noShortInterval };
}

export function SourceComparison() {
  const [tv, setTv] = useState<{ average: Prices; close: Prices } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadsAllowed = useDownloadsAllowed();

  useEffect(() => {
    const get = (method: string) =>
      fetch(`/api/prices?assets=SPX,XAU,SOL&source=tradingview&from=${FROM}&to=${TO}&method=${method}`).then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
        return { months: b.months as string[], prices: DEFAULT_ASSETS.map((a) => b.prices[a] as number[]) };
      });
    Promise.all([get("average"), get("close")])
      .then(([average, close]) => setTv({ average, close }))
      .catch((e) => setError(e.message));
  }, []);

  const ia = useMemo(() => DEFAULT_ASSETS.map((a) => SNAPSHOT.map((r) => r[ASSETS[a].snapshotKey])), []);
  const iaFixed = useMemo(() => ia.map((p, i) => (DEFAULT_ASSETS[i] === "SPX" ? p.map((v, t) => (SNAPSHOT[t].month === "2023-09" ? SEP_2023_SPX_AVERAGE : v)) : p)), [ia]);

  const rows = useMemo(() => {
    const list = [
      { label: "IA snapshot", detail: "FRED/Shiller, World Bank, Kraken (Thu–Wed weeks)", ...summarise(ia) },
      { label: "IA, Sep 2023 S&P corrected", detail: `S&P 500 Sep 2023 = ${SEP_2023_SPX_AVERAGE.toFixed(2)} instead of ${SNAPSHOT[1].sp500}`, ...summarise(iaFixed) },
    ];
    if (tv) {
      list.push({ label: "TradingView, monthly averages", detail: "daily S&P and gold closes, Kraken weekly (Mon–Sun) SOL closes", ...summarise(tv.average.prices) });
      list.push({ label: "TradingView, month-end closes", detail: "last close of each month", ...summarise(tv.close.prices) });
    }
    return list;
  }, [ia, iaFixed, tv]);

  // Month-by-month gap between TradingView averages and the IA's numbers.
  const gaps = useMemo(() => {
    if (!tv) return null;
    return SNAPSHOT.map((r) => {
      const t = tv.average.months.indexOf(r.month);
      return { month: r.month, gap: DEFAULT_ASSETS.map((a, i) => (t < 0 ? NaN : tv.average.prices[i][t] / r[ASSETS[a].snapshotKey] - 1)) };
    });
  }, [tv]);

  const bandText = (b: { lower: number; upper: number } | null) => (b ? `${pct(b.lower, 3)} to ${pct(b.upper, 3)}` : "none");
  const header = ["Dataset", "Minimum σ", ...DEFAULT_ASSETS.map((a) => `Weight ${ASSETS[a].short}`), "No-short band"];
  const tableRows = rows.map((r) => [r.label, pct(r.sigma, 3), ...r.weights.map((w) => pct(w, 1)), bandText(r.band)]);
  const sep = gaps?.find((g) => g.month === "2023-09");

  return (
    <>
      <p>
        The IA&apos;s prices came from FRED, the World Bank and Kraken. TradingView shows the same assets on its charts. Here the same {SNAPSHOT.length} months are loaded from{" "}
        TradingView (bundled with the site, so this works offline) and pushed through the same maths.
      </p>
      {error && <div className="banner">Could not load the TradingView data: {error}</div>}
      {!tv && !error && <p className="note">Loading TradingView data…</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr>{header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={r.label}>
                <td><strong>{r.label}</strong><div className="note">{r.detail}</div></td>
                {tableRows[k].slice(1).map((c, j) => <td key={j}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {downloadsAllowed && <button className="btn" onClick={() => exportCsv(header, tableRows, "dataset-comparison", CAPTION)}>Download table as CSV</button>}

      {gaps && (
        <Figure
          title="How far TradingView's monthly averages are from the IA's"
          alt="Line chart of the percentage gap between TradingView monthly averages and the IA snapshot for each month and asset. The S&P 500 gap is zero except for a 2.4% dip in September 2023; gold stays within about half a percent; Solana swings up to about 9% because its weeks are cut differently."
          caption={CAPTION}
          table={{ header: ["Month", ...DEFAULT_ASSETS.map((a) => `${ASSETS[a].name} gap`)], rows: gaps.map((g) => [g.month, ...g.gap.map((x) => spct(x, 2))]) }}
          note={<Legend items={DEFAULT_ASSETS.map((a) => ({ label: ASSETS[a].name, color: ASSETS[a].color }))} />}
        >
          <GapChart months={gaps.map((g) => g.month)} gaps={DEFAULT_ASSETS.map((_, i) => gaps.map((g) => g.gap[i]))} />
        </Figure>
      )}
      {sep && (
        <p className="note">
          Spotted by this comparison: in {monthLabel("2023-09")} the S&amp;P 500 gap is {spct(sep.gap[0], 2)} while every other month is 0.00%. The IA&apos;s value{" "}
          ({SNAPSHOT[1].sp500}) is the 1 September close (4515.78), not the month&apos;s average ({SEP_2023_SPX_AVERAGE.toFixed(2)}). The second row shows the effect of correcting it.
        </p>
      )}
    </>
  );
}

function GapChart({ months, gaps }: { months: string[]; gaps: number[][] }) {
  const ext = Math.max(0.01, ...gaps.flat().filter(Number.isFinite).map(Math.abs)) * 1.1;
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  return (
    <Plot
      height={240}
      xDomain={[0, months.length - 1]}
      yDomain={[-ext, ext]}
      xTickValues={months.map((m, i) => (m.endsWith("-01") ? i : -1)).filter((i) => i >= 0)}
      xFormat={(i) => months[Math.round(i)]?.slice(0, 4) ?? ""}
      yFormat={(v) => spct(v, 0)}
      yLabel="TradingView ÷ IA − 1"
      onPointer={(d, px) => setHover({ i: Math.max(0, Math.min(months.length - 1, Math.round(d.x))), x: px.x, y: px.y })}
      onLeave={() => setHover(null)}
      tooltip={hover ? { x: hover.x, y: hover.y, content: <div><strong>{monthLabel(months[hover.i])}</strong>{DEFAULT_ASSETS.map((a, k) => <div key={a}>{ASSETS[a].name}: {spct(gaps[k][hover.i], 2)}</div>)}</div> } : null}
    >
      {({ x, y }) => (
        <>
          <line x1={x(0)} x2={x(months.length - 1)} y1={y(0)} y2={y(0)} stroke="var(--border)" />
          {gaps.map((g, k) => (
            <g key={k}>
              <path d={g.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("")} fill="none" stroke={ASSETS[DEFAULT_ASSETS[k]].color} strokeWidth={2} />
              {g.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={ASSETS[DEFAULT_ASSETS[k]].color} />)}
            </g>
          ))}
        </>
      )}
    </Plot>
  );
}
