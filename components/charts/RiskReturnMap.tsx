"use client";
/** Risk (σ) on x, return (μ) on y: assets, a cloud of possible mixes, and "your" portfolio. */
import { useState } from "react";
import { ASSETS, DEFAULT_ASSETS } from "@/lib/assets";
import { pct } from "@/lib/format";
import { Plot } from "./Plot";

export interface RRPoint {
  sd: number;
  mu: number;
  label?: string;
}

export function RiskReturnMap({
  assetPoints, cloud, you, extra, xMax, yDomain, children,
}: {
  assetPoints: RRPoint[];
  cloud?: RRPoint[];
  you?: RRPoint;
  extra?: { point: RRPoint; color: string; label: string }[];
  xMax?: number;
  yDomain?: [number, number];
  children?: Parameters<typeof Plot>[0]["children"];
}) {
  const [hover, setHover] = useState<{ p: RRPoint; x: number; y: number; name: string } | null>(null);
  const all = [...assetPoints, ...(cloud ?? []), ...(you ? [you] : [])];
  const xm = xMax ?? Math.max(...all.map((p) => p.sd)) * 1.08;
  const yd = yDomain ?? [Math.min(0, ...all.map((p) => p.mu)) - 0.003, Math.max(...all.map((p) => p.mu)) * 1.12];
  return (
    <Plot
      xDomain={[0, xm]}
      yDomain={yd}
      xFormat={(v) => pct(v, 0)}
      yFormat={(v) => pct(v, 1)}
      xLabel="Risk: standard deviation of monthly return"
      yLabel="Mean monthly return"
      tooltip={hover && { x: hover.x, y: hover.y, content: <div><strong>{hover.name}</strong><div>risk {pct(hover.p.sd)}</div><div>return {pct(hover.p.mu)}</div></div> }}
    >
      {(ctx) => {
        const { x, y } = ctx;
        const show = (p: RRPoint, name: string) => (e: React.PointerEvent) => {
          const r = ((e.currentTarget as SVGGraphicsElement).ownerSVGElement as SVGSVGElement).getBoundingClientRect();
          setHover({ p, name, x: e.clientX - r.left, y: e.clientY - r.top });
        };
        return (
          <>
            {cloud?.map((p, i) => (
              <circle key={i} cx={x(p.sd)} cy={y(p.mu)} r={1.8} fill="var(--c-neutral)" opacity={0.35} />
            ))}
            {children?.(ctx)}
            {assetPoints.map((p, i) => {
              const a = ASSETS[DEFAULT_ASSETS[i]];
              return (
                <g key={a.id} onPointerEnter={show(p, a.name)} onPointerLeave={() => setHover(null)}>
                  <circle cx={x(p.sd)} cy={y(p.mu)} r={12} fill="transparent" />
                  <circle cx={x(p.sd)} cy={y(p.mu)} r={6} fill={a.color} stroke="var(--surface)" strokeWidth={2} />
                  <text className="label" x={x(p.sd) + (x(p.sd) > ctx.innerW - 60 ? -9 : 9)} y={y(p.mu)} dy="-0.5em" textAnchor={x(p.sd) > ctx.innerW - 60 ? "end" : "start"}>
                    {a.name}
                  </text>
                </g>
              );
            })}
            {extra?.map((e) => (
              <g key={e.label} onPointerEnter={show(e.point, e.label)} onPointerLeave={() => setHover(null)}>
                <circle cx={x(e.point.sd)} cy={y(e.point.mu)} r={6} fill="none" stroke={e.color} strokeWidth={2.5} />
                <text className="label" x={x(e.point.sd) + 9} y={y(e.point.mu)} dy="1.1em">{e.label}</text>
              </g>
            ))}
            {you && (
              <g onPointerEnter={show(you, "Your portfolio")} onPointerLeave={() => setHover(null)}>
                <circle cx={x(you.sd)} cy={y(you.mu)} r={8} fill="var(--c-you)" stroke="var(--surface)" strokeWidth={2} />
                <text className="label" x={x(you.sd) + 11} y={y(you.mu)} dy="0.32em">You</text>
              </g>
            )}
          </>
        );
      }}
    </Plot>
  );
}
