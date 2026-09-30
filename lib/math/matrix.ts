/**
 * Small, readable matrix helpers. Matrices are arrays of rows:
 * M[i][j] is row i, column j (both starting at 0).
 *
 * These are written for clarity, not speed; our matrices are 3×3.
 */
import type { Matrix, Vector } from "./stats";

export type { Matrix, Vector };

/** The n×n identity matrix I. */
export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/** Deep copy so we never mutate a caller's matrix. */
export function clone(M: Matrix): Matrix {
  return M.map((row) => row.slice());
}

/** Transpose: (Mᵀ)_ij = M_ji */
export function transpose(M: Matrix): Matrix {
  return M[0].map((_, j) => M.map((row) => row[j]));
}

/**
 * Matrix product (AB)_ij = Σ_k A_ik B_kj.
 * Requires columns(A) = rows(B).
 */
export function multiply(A: Matrix, B: Matrix): Matrix {
  if (A[0].length !== B.length) throw new Error("dimension mismatch in multiply");
  return A.map((row) =>
    B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)),
  );
}

/** Matrix × column vector: (Mv)_i = Σ_j M_ij v_j */
export function matVec(M: Matrix, v: Vector): Vector {
  return M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0));
}

/** Dot product uᵀv = Σ u_i v_i */
export function dot(u: Vector, v: Vector): number {
  return u.reduce((s, x, i) => s + x * v[i], 0);
}

/** Quadratic form xᵀ M y. With x = y = w and M = Σ this is the portfolio variance. */
export function quadraticForm(x: Vector, M: Matrix, y: Vector = x): number {
  return dot(x, matVec(M, y));
}

/** Vector helpers used in the Markowitz formulas. */
export const ones = (n: number): Vector => new Array(n).fill(1);
export const add = (u: Vector, v: Vector): Vector => u.map((x, i) => x + v[i]);
export const sub = (u: Vector, v: Vector): Vector => u.map((x, i) => x - v[i]);
export const scale = (c: number, v: Vector): Vector => v.map((x) => c * x);
export const sum = (v: Vector): number => v.reduce((s, x) => s + x, 0);

/**
 * Determinant by cofactor (Laplace) expansion along the first row:
 *
 *   det M = Σ_j (−1)^j M_0j det(minor_0j)
 *
 * Fine for the 2×2 and 3×3 matrices in this project and easy to check by hand.
 */
export function determinant(M: Matrix): number {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  let det = 0;
  for (let j = 0; j < n; j++) {
    det += (j % 2 === 0 ? 1 : -1) * M[0][j] * determinant(minor(M, 0, j));
  }
  return det;
}

/** The matrix left after deleting row r and column c. */
export function minor(M: Matrix, r: number, c: number): Matrix {
  return M.filter((_, i) => i !== r).map((row) => row.filter((_, j) => j !== c));
}

/** One elementary row operation performed during Gauss–Jordan elimination. */
export interface RowOperation {
  kind: "swap" | "scale" | "eliminate";
  /** Human-readable, e.g. "R2 → R2 − 0.31·R1" (rows numbered from 1 for readers). */
  description: string;
  /** Same operation in LaTeX, e.g. "R_2 \\to R_2 - 0.31\\,R_1". */
  latex: string;
  /** Why this operation was chosen (for the "why this step?" notes). */
  reason: string;
  /** The augmented matrix [M | I] after this operation. */
  augmented: Matrix;
}

export interface InverseResult {
  inverse: Matrix;
  steps: RowOperation[];
}

const fmt = (x: number) => {
  const r = Number(x.toPrecision(4));
  return Math.abs(r) >= 1e4 || (Math.abs(r) < 1e-3 && r !== 0) ? r.toExponential(3) : String(r);
};

/**
 * Inverse by Gauss–Jordan elimination with partial pivoting.
 *
 * Idea: write the augmented matrix [M | I]. Apply row operations that turn
 * the left half into I. Because every row operation is multiplication by an
 * invertible matrix E, we end with [E…E M | E…E I] = [I | M⁻¹].
 *
 * Partial pivoting: before clearing column c we swap in the row with the
 * largest |entry| in that column. Dividing by a tiny pivot would magnify
 * rounding errors, so we always divide by the biggest available number.
 *
 * @param recordSteps if true, every row operation is returned so the site can
 *                    show the inversion step by step.
 * @throws if M is singular (no inverse exists)
 */
export function inverse(M: Matrix, recordSteps = false): InverseResult {
  const n = M.length;
  // Build [M | I]
  const aug: Matrix = M.map((row, i) => [...row, ...identity(n)[i]]);
  const steps: RowOperation[] = [];
  const record = (s: Omit<RowOperation, "augmented">) => {
    if (recordSteps) steps.push({ ...s, augmented: clone(aug) });
  };

  for (let col = 0; col < n; col++) {
    // 1. Partial pivoting: find the row (at or below `col`) with the largest |value| in this column.
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(aug[pivotRow][col]) < 1e-300) throw new Error("matrix is singular: no inverse");
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
      record({
        kind: "swap",
        description: `R${col + 1} ↔ R${pivotRow + 1}`,
        latex: `R_{${col + 1}} \\leftrightarrow R_{${pivotRow + 1}}`,
        reason: `Row ${pivotRow + 1} has the largest entry in column ${col + 1}, so using it as the pivot keeps rounding errors small.`,
      });
    }

    // 2. Scale the pivot row so the pivot becomes 1.
    const p = aug[col][col];
    if (p !== 1) {
      for (let j = 0; j < 2 * n; j++) aug[col][j] /= p;
      record({
        kind: "scale",
        description: `R${col + 1} → R${col + 1} ÷ ${fmt(p)}`,
        latex: `R_{${col + 1}} \\to \\dfrac{R_{${col + 1}}}{${fmt(p)}}`,
        reason: `Make the pivot in column ${col + 1} equal to 1.`,
      });
    }

    // 3. Clear every other entry in this column: R_r → R_r − factor · R_col.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[col][j];
      aug[r][col] = 0; // exact zero (removes −1e−20 style noise)
      const sign = factor >= 0 ? "−" : "+";
      record({
        kind: "eliminate",
        description: `R${r + 1} → R${r + 1} ${sign} ${fmt(Math.abs(factor))}·R${col + 1}`,
        latex: `R_{${r + 1}} \\to R_{${r + 1}} ${factor >= 0 ? "-" : "+"} ${fmt(Math.abs(factor))}\\,R_{${col + 1}}`,
        reason: `Make the entry in row ${r + 1}, column ${col + 1} zero, using the pivot row.`,
      });
    }
  }

  return { inverse: aug.map((row) => row.slice(n)), steps };
}

/** Convenience: just the inverse matrix. */
export function inv(M: Matrix): Matrix {
  return inverse(M).inverse;
}

/**
 * Cholesky decomposition M = L Lᵀ with L lower-triangular.
 *
 *   L_jj = √( M_jj − Σ_{k<j} L_jk² )
 *   L_ij = ( M_ij − Σ_{k<j} L_ik L_jk ) / L_jj   for i > j
 *
 * It only succeeds when M is symmetric positive definite (every square root
 * is of a positive number), which is exactly the test we need for a valid
 * covariance matrix. Returns null if it fails.
 */
export function cholesky(M: Matrix): Matrix | null {
  const n = M.length;
  const L: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let d = M[j][j];
    for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k];
    if (!(d > 0)) return null; // not positive definite (also catches NaN)
    L[j][j] = Math.sqrt(d);
    for (let i = j + 1; i < n; i++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = s / L[j][j];
    }
  }
  return L;
}

/**
 * A symmetric matrix is positive definite when xᵀMx > 0 for every x ≠ 0.
 * For a covariance matrix this means every portfolio (except "hold nothing")
 * has strictly positive variance. We test it with Cholesky.
 */
export function isPositiveDefinite(M: Matrix): boolean {
  const n = M.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (Math.abs(M[i][j] - M[j][i]) > 1e-12 * (Math.abs(M[i][j]) + 1e-300)) return false;
  return cholesky(M) !== null;
}

/** Largest absolute difference between two matrices (for "≈" checks). */
export function maxAbsDiff(A: Matrix, B: Matrix): number {
  let m = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) m = Math.max(m, Math.abs(A[i][j] - B[i][j]));
  return m;
}
