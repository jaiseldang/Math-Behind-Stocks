/** Display helpers: sensible rounding and units everywhere on the site. */

/** 0.01582 → "1.58%" */
export function pct(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}

/** Signed percentage: "+1.58%" / "−0.20%" */
export function spct(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "—";
  return `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(dp)}%`;
}

/** 537.359 → "$537.36" (negative → "−$19.75") */
export function usd(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "—";
  const s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${x < 0 ? "−" : ""}$${s}`;
}

/** Significant figures, with a proper minus sign. */
export function sig(x: number, sf = 4): string {
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  const a = Math.abs(x);
  const s = a >= 1e-4 && a < 1e6 ? String(Number(a.toPrecision(sf))) : a.toExponential(sf - 1);
  return (x < 0 ? "−" : "") + s;
}

/** Fixed decimals with a proper minus sign. */
export function fix(x: number, dp = 4): string {
  if (!Number.isFinite(x)) return "—";
  return (x < 0 ? "−" : "") + Math.abs(x).toFixed(dp);
}

/** Number formatted for LaTeX (uses "-" which KaTeX turns into a minus). */
export function tex(x: number, sf = 4): string {
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a < 1e-3 || a >= 1e6) {
    const [m, e] = a.toExponential(sf - 1).split("e");
    return `${x < 0 ? "-" : ""}${m}\\times10^{${Number(e)}}`;
  }
  return String(Number(x.toPrecision(sf)));
}

/** "2024-03" → "Mar 2024" */
export function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** LaTeX for a matrix. */
export function texMatrix(M: number[][], sf = 4): string {
  return `\\begin{pmatrix}${M.map((r) => r.map((v) => tex(v, sf)).join(" & ")).join(" \\\\ ")}\\end{pmatrix}`;
}

/** LaTeX for a column vector. */
export function texVector(v: number[], sf = 4): string {
  return texMatrix(v.map((x) => [x]), sf);
}

/** Plain decimal for LaTeX tables (no ×10ⁿ), tiny rounding noise shown as 0. */
export function texNum(x: number, sf = 4): string {
  if (Math.abs(x) < 1e-12) return "0";
  const r = Number(x.toPrecision(sf));
  const s = Math.abs(r) < 1e-6 ? r.toExponential(sf - 1) : r.toFixed(Math.max(0, sf - 1 - Math.floor(Math.log10(Math.abs(r)))));
  return s.replace(/^(-?\d+\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** LaTeX for a matrix using plain decimals. */
export function texMatrixPlain(M: number[][], sf = 4): string {
  return `\\begin{pmatrix}${M.map((r) => r.map((v) => texNum(v, sf)).join(" & ")).join(" \\\\ ")}\\end{pmatrix}`;
}

/** LaTeX for an augmented matrix [left | right]. */
export function texAugmented(M: number[][], split: number, sf = 4): string {
  const cols = "c".repeat(split) + "|" + "c".repeat(M[0].length - split);
  return `\\left(\\begin{array}{${cols}}${M.map((r) => r.map((v) => texNum(v, sf)).join(" & ")).join(" \\\\ ")}\\end{array}\\right)`;
}
