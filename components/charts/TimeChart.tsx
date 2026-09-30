"use client";
/** Multi-series line chart over months with a crosshair tooltip. */
import { line } from "d3";
import { useState } from "react";
import { monthLabel } from "@/lib/format";
import { Plot } from "./Plot";

export interface TimeSeries {
  id: string;
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export function TimeChart({
  months, series, yFormat, yLabel, yLog, height, zeroLine, yDomain,
}: {
  months: string[];
  series: TimeSeries[];
  yFormat: (v: number) => string;
  yLabel?: string;
  yLog?: boolean;
  height?: number;
  zeroLine?: boolean;
  yDomain?: [number, number];
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null);
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo) * 0.06 || 1;
  const domain: [number, number] = yDomain ?? (yLog ? [lo * 0.9, hi * 1.1] : [lo - pad, hi + pad]);
  const n = months.length;
  // tick at each January (or every 6 months on short ranges)
  const ticks = months.map((m, i) => (m.endsWith("-01") || (n < 16 && m.endsWith("-07")) ? i : -1)).filter((i) => i >= 0);

  return (
    <Plot
      height={height}
      xDomain={[0, n - 1]}
      yDomain={domain}
      yLog={yLog}
      xTickValues={ticks}
      xFormat={(i) => months[Math.round(i)]?.slice(0, 4) ?? ""}
      yFormat={yFormat}
      yLabel={yLabel}
      margin={{ right: 52 }}
      zeroLineY={zeroLine}
      onPointer={(d, px) => setHover({ i: Math.max(0, Math.min(n - 1, Math.round(d.x))), px: px.x, py: px.y })}
      onLeave={() => setHover(null)}
      tooltip={
        hover && {
          x: hover.px,
          y: hover.py,
          content: (
            <div>
              <strong>{monthLabel(months[hover.i])}</strong>
              {series.map((s) => (
                <div key={s.id}>
                  <span className="swatch" style={{ background: s.color }} />
                  {s.name}: {yFormat(s.values[hover.i])}
                </div>
              ))}
            </div>
          ),
        }
      }
    >
      {({ x, y, innerH }) => {
        const gen = line<number>().defined(Number.isFinite).x((_, i) => x(i)).y((v) => y(v));
        return (
          <>
            {series.map((s) => (
              <path key={s.id} d={gen(s.values) ?? ""} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {endLabels(series.map((s) => ({ id: s.id, name: s.name.split(" ")[0], y: y(s.values[s.values.length - 1]) }))).map((l) => (
              <text key={`l${l.id}`} className="label" x={x(n - 1) + 4} y={l.y} dy="0.32em" style={{ fontSize: 11 }}>
                {l.name}
              </text>
            ))}
            {hover && (
              <>
                <line x1={x(hover.i)} x2={x(hover.i)} y2={innerH} stroke="var(--axis)" strokeDasharray="3 3" />
                {series.map((s) => Number.isFinite(s.values[hover.i]) && (
                  <circle key={s.id} cx={x(hover.i)} cy={y(s.values[hover.i])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </>
            )}
          </>
        );
      }}
    </Plot>
  );
}

/** Push end-of-line labels apart so they never overlap (at least 13px between them). */
function endLabels(labels: { id: string; name: string; y: number }[], gap = 13) {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < gap) sorted[i] = { ...sorted[i], y: sorted[i - 1].y + gap };
  }
  return sorted;
}
