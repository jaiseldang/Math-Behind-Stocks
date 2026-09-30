/**
 * Export helpers for the write-up: charts as SVG/PNG, tables as CSV.
 * Every export carries a caption with the data source and date range.
 */

const STYLE_PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-weight", "font-family", "text-anchor", "dominant-baseline"];

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy the chart, replacing CSS variables with real colours, and add a caption strip. */
export function standaloneSvg(svg: SVGSVGElement, title: string, caption: string): { markup: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll("*");
  const dst = clone.querySelectorAll("*");
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const target = dst[i] as SVGElement;
    for (const p of STYLE_PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) target.style.setProperty(p, v);
    }
  });
  const box = svg.viewBox.baseVal;
  const width = box && box.width ? box.width : svg.clientWidth;
  const height = box && box.height ? box.height : svg.clientHeight;
  const pageStyle = getComputedStyle(document.body);
  const bg = pageStyle.getPropertyValue("--surface").trim() || "#ffffff";
  const ink = pageStyle.getPropertyValue("--ink").trim() || "#000000";
  const muted = pageStyle.getPropertyValue("--muted").trim() || "#666666";
  const top = 28;
  const bottom = 34;
  const total = height + top + bottom;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const inner = clone.innerHTML;
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" font-family="system-ui, sans-serif">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<text x="8" y="19" font-size="14" font-weight="700" fill="${ink}">${esc(title)}</text>` +
    `<g transform="translate(0 ${top})">${inner}</g>` +
    wrapCaption(caption, width).map((line, i) => `<text x="8" y="${height + top + 16 + i * 13}" font-size="10.5" fill="${muted}">${esc(line)}</text>`).join("") +
    `</svg>`;
  return { markup, width, height: total };
}

function wrapCaption(text: string, width: number): string[] {
  const max = Math.max(40, Math.floor(width / 5.6));
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 2);
}

export function exportSvg(svg: SVGSVGElement, filename: string, title: string, caption: string) {
  const { markup } = standaloneSvg(svg, title, caption);
  download(new Blob([markup], { type: "image/svg+xml" }), `${filename}.svg`);
}

export async function exportPng(svg: SVGSVGElement, filename: string, title: string, caption: string, scale = 2) {
  const { markup, width, height } = standaloneSvg(svg, title, caption);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("could not render chart"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  canvas.toBlob((b) => b && download(b, `${filename}.png`), "image/png");
}

export function toCsv(header: string[], rows: (string | number)[][], caption?: string): string {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v) : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  if (caption) lines.push("", cell(caption));
  return lines.join("\n");
}

export function exportCsv(header: string[], rows: (string | number)[][], filename: string, caption: string) {
  download(new Blob([toCsv(header, rows, caption)], { type: "text/csv" }), `${filename}.csv`);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
