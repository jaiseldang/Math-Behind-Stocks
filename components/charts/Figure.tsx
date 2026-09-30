"use client";
import { useRef, useState } from "react";
import { useData } from "@/components/providers";
import { exportCsv, exportPng, exportSvg, slug } from "@/lib/export";

export interface TableData {
  header: string[];
  rows: (string | number)[][];
}

/**
 * Wraps every chart: title, export buttons (PNG, SVG, CSV), an optional table
 * view (so the numbers never depend on colour alone), and a caption naming the
 * data source and date range.
 */
export function Figure({
  title, children, table, caption, alt, note,
}: {
  title: string;
  children: React.ReactNode;
  table?: TableData;
  /** Overrides the default data-source caption. */
  caption?: string;
  /** Text description of what the chart shows (for screen readers). */
  alt: string;
  note?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { sourceNote } = useData();
  const [showTable, setShowTable] = useState(false);
  const cap = caption ?? sourceNote;
  const svg = () => ref.current?.querySelector("svg.chart") as SVGSVGElement | null;
  const name = slug(title);

  return (
    <figure className="figure" style={{ margin: "12px 0" }}>
      <div className="figure-head">
        <div className="figure-title">{title}</div>
        <div className="export-menu" role="group" aria-label={`Export ${title}`}>
          <button className="btn" onClick={() => svg() && exportPng(svg()!, name, title, cap)}>PNG</button>
          <button className="btn" onClick={() => svg() && exportSvg(svg()!, name, title, cap)}>SVG</button>
          {table && <button className="btn" onClick={() => exportCsv(table.header, table.rows, name, cap)}>CSV</button>}
          {table && (
            <button className="btn" aria-pressed={showTable} onClick={() => setShowTable(!showTable)}>
              Table
            </button>
          )}
        </div>
      </div>
      <div ref={ref} role="group" aria-label={alt}>
        {children}
      </div>
      {note}
      {showTable && table && (
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }} tabIndex={0} role="region" aria-label={`${title}: data table`}>
          <table className="data">
            <thead>
              <tr>{table.header.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j}>{typeof c === "number" ? Number(c.toPrecision(6)) : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <figcaption className="figure-caption">{cap}</figcaption>
    </figure>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend" aria-hidden>
      {items.map((it) => (
        <span key={it.label}>
          <svg width="18" height="10" style={{ marginRight: 5, verticalAlign: "middle" }}>
            <line x1="1" x2="17" y1="5" y2="5" stroke={it.color} strokeWidth={it.dashed ? 2 : 3} strokeDasharray={it.dashed ? "4 3" : undefined} strokeLinecap="round" />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}
