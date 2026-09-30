"use client";
/** Each optimal weight plotted against the target return μ*. */
import { useState } from "react";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct } from "@/lib/format";
import type { Vector } from "@/lib/math";
import { Plot } from "./Plot";

export function WeightLines({
  g, h, from, to, target, crossings, band, showLines = true,
}: {
  g: Vector;
  h: Vector;
  from: number;
  to: number;
  target?: number;
  crossings?: (number | null)[];
  band?: { lower: number; upper: number } | null;
  showLines?: boolean;
}) {
  const [hover, setHover] = useState<{ mu: number; x: number; y: number } | null>(null);
  const ws = [from, to].flatMap((m) => g.map((gi, i) => gi + h[i] * m));
  const lo = Math.min(-0.2, ...ws);
  const hi = Math.max(1.1, ...ws);
  return (
    <Plot
      xDomain={[from, to]}
      yDomain={[lo, hi]}
      xFormat={(v) => pct(v, 1)}
      yFormat={(v) => pct(v, 0)}
      xLabel="Target monthly return μ*"
      yLabel="Optimal weight"
      zeroLineY
      margin={{ right: 56 }}
      onPointer={(d, px) => setHover({ mu: Math.max(from, Math.min(to, d.x)), x: px.x, y: px.y })}
      onLeave={() => setHover(null)}
      tooltip={
        hover && {
          x: hover.x,
          y: hover.y,
          content: (
            <div>
              <strong>μ* = {pct(hover.mu)}</strong>
              {DEFAULT_ASSETS.map((a, i) => (
                <div key={a}><span className="swatch" style={{ background: ASSETS[a].color }} />{ASSETS[a].name}: {pct(g[i] + h[i] * hover.mu, 1)}</div>
              ))}
            </div>
          ),
        }
      }
    >
      {({ x, y, innerH }) => (
        <>
          {band && (
            <>
              <rect x={x(Math.max(from, band.lower))} width={Math.max(0, x(Math.min(to, band.upper)) - x(Math.max(from, band.lower)))} y={0} height={innerH} fill="var(--good)" opacity={0.1} />
              <text x={x((Math.max(from, band.lower) + Math.min(to, band.upper)) / 2)} y={14} textAnchor="middle" className="label" style={{ fontSize: 11 }}>no short-selling</text>
            </>
          )}
          {showLines &&
            DEFAULT_ASSETS.map((a, i) => (
              <g key={a}>
                <line x1={x(from)} x2={x(to)} y1={y(g[i] + h[i] * from)} y2={y(g[i] + h[i] * to)} stroke={ASSETS[a].color} strokeWidth={2.5} strokeLinecap="round" />
                <text className="label" x={x(to) + 5} y={y(g[i] + h[i] * to)} dy="0.32em">{ASSETS[a].short}</text>
              </g>
            ))}
          {crossings?.map((c, i) =>
            c !== null && c >= from && c <= to ? (
              <g key={i}>
                <line x1={x(c)} x2={x(c)} y1={y(0) - 30} y2={y(0) + 30} stroke={ASSETS[DEFAULT_ASSETS[i]].color} strokeDasharray="3 3" />
                <circle cx={x(c)} cy={y(0)} r={5} fill="var(--surface)" stroke={ASSETS[DEFAULT_ASSETS[i]].color} strokeWidth={2.5} />
                <text x={x(c)} y={y(0) + 44} textAnchor="middle" className="label" style={{ fontSize: 10.5 }}>{pct(c, 2)}</text>
              </g>
            ) : null,
          )}
          {target !== undefined && showLines && (
            <>
              <line x1={x(target)} x2={x(target)} y1={0} y2={innerH} stroke="var(--c-you)" strokeWidth={1.5} />
              {g.map((gi, i) => (
                <circle key={i} cx={x(target)} cy={y(gi + h[i] * target)} r={4.5} fill={ASSETS[DEFAULT_ASSETS[i]].color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </>
          )}
        </>
      )}
    </Plot>
  );
}
