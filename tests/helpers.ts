import { expect } from "vitest";

/** Count the significant figures in a decimal string such as "0.017804" (→ 5) or "-60.100" (→ 5). */
export function sigFigs(s: string): number {
  const digits = s.replace(/^[-+]/, "").replace(".", "").replace(/^0+/, "");
  return digits.length;
}

/**
 * Assert that `actual` rounds to `expected` at the number of significant
 * figures written in `expected`, e.g. expectSig(0.0158201, "0.01582").
 */
export function expectSig(actual: number, expected: string, label = "") {
  const sf = sigFigs(expected);
  const rounded = Number(actual.toPrecision(sf));
  expect(rounded, `${label}: ${actual} to ${sf} s.f.`).toBe(Number(expected));
}
