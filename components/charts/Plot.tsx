"use client";
/**
 * The base for every chart: measures its width, builds linear (or log) scales,
 * draws a recessive grid and axes, and hands the scales to the chart's own
 * drawing code. Pointer position is reported in data coordinates so charts can
 * show tooltips, accept clicks, or be dragged.
 */
import { scaleLinear, scaleLog, type ScaleContinuousNumeric } from "d3";
import { useEffect, useRef, useState } from "react";

export interface PlotCtx {
  x: ScaleContinuousNumeric<number, number>;
  y: ScaleContinuousNumeric<number, number>;
  width: number;
  height: number;
  innerW: number;
  innerH: number;
  /** Convert a pointer event to data coordinates. */
  toData: (e: React.PointerEvent | PointerEvent) => { x: number; y: number };
}

export interface PlotProps {
  height?: number;
  aspect?: number;
  xDomain: [number, number];
  yDomain: [number, number];
  yLog?: boolean;
  xTicks?: number;
  yTicks?: number;
  xTickValues?: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
  margin?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  zeroLineX?: boolean;
  zeroLineY?: boolean;
  onPointer?: (d: { x: number; y: number }, px: { x: number; y: number }) => void;
  onLeave?: () => void;
  onClick?: (d: { x: number; y: number }) => void;
  tooltip?: { x: number; y: number; content: React.ReactNode } | null;
  children: (ctx: PlotCtx) => React.ReactNode;
  cursor?: string;
  /** Same scale on both axes (needed when angles matter, e.g. perpendicular gradients). */
  equalAspect?: boolean;
}

export function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Plot(p: PlotProps) {
  const [ref, width] = useWidth();
  const m = { top: 12, right: 16, bottom: p.xLabel ? 44 : 28, left: p.yLabel ? 62 : 48, ...p.margin };
  const innerW = width - m.left - m.right;
  const height = p.equalAspect
    ? Math.round(innerW * ((p.yDomain[1] - p.yDomain[0]) / (p.xDomain[1] - p.xDomain[0]))) + m.top + m.bottom
    : p.height ?? Math.round(Math.min(420, Math.max(220, width * (p.aspect ?? 0.55))));
  const innerH = height - m.top - m.bottom;
  const x = scaleLinear().domain(p.xDomain).range([0, innerW]);
  const y = (p.yLog ? scaleLog() : scaleLinear()).domain(p.yDomain).range([innerH, 0]);
  const svgRef = useRef<SVGSVGElement>(null);

  const toData = (e: React.PointerEvent | PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = e.clientX - r.left - m.left;
    const py = e.clientY - r.top - m.top;
    return { x: x.invert(px), y: y.invert(py) };
  };
  const ctx: PlotCtx = { x, y, width, height, innerW, innerH, toData };
  const xTicks = p.xTickValues ?? x.ticks(p.xTicks ?? Math.max(3, Math.floor(innerW / 90)));
  const yTicks = p.yLog ? y.ticks(5).filter((_, i, a) => a.length < 8 || i % 2 === 0) : y.ticks(p.yTicks ?? Math.max(3, Math.floor(innerH / 50)));
  const fx = p.xFormat ?? ((v: number) => String(v));
  const fy = p.yFormat ?? ((v: number) => String(v));

  return (
    <div ref={ref} className="chart-wrap">
      <svg
        ref={svgRef}
        className="chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={(e) => {
          if (!p.onPointer) return;
          const r = svgRef.current!.getBoundingClientRect();
          p.onPointer(toData(e), { x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onPointerLeave={p.onLeave}
        onClick={(e) => p.onClick?.(toData(e as unknown as React.PointerEvent))}
        style={{ cursor: p.cursor, touchAction: p.onPointer ? "pan-y" : undefined }}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {yTicks.map((t) => (
            <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
              <line className="grid-line" x2={innerW} strokeWidth={1} />
              <text x={-6} dy="0.32em" textAnchor="end">{fy(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`} transform={`translate(${x(t)},${innerH})`}>
              <line className="axis-line" y2={4} />
              <text y={16} textAnchor="middle">{fx(t)}</text>
            </g>
          ))}
          <line className="axis-line" y1={innerH} y2={innerH} x2={innerW} />
          {p.zeroLineY && y.domain()[0] < 0 && y.domain()[1] > 0 && (
            <line x2={innerW} y1={y(0)} y2={y(0)} stroke="var(--ink-2)" strokeWidth={1} />
          )}
          {p.zeroLineX && x.domain()[0] < 0 && x.domain()[1] > 0 && (
            <line y2={innerH} x1={x(0)} x2={x(0)} stroke="var(--ink-2)" strokeWidth={1} />
          )}
          {p.xLabel && <text className="axis-title" x={innerW / 2} y={innerH + 36} textAnchor="middle">{p.xLabel}</text>}
          {p.yLabel && (
            <text className="axis-title" transform={`translate(${-m.left + 14},${innerH / 2}) rotate(-90)`} textAnchor="middle">
              {p.yLabel}
            </text>
          )}
          {p.children(ctx)}
        </g>
      </svg>
      {p.tooltip && (
        <div className="tooltip" style={{ left: Math.min(p.tooltip.x + 12, width - 170), top: Math.max(0, p.tooltip.y - 10) }}>
          {p.tooltip.content}
        </div>
      )}
    </div>
  );
}
