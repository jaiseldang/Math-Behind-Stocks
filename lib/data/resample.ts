/**
 * Turning daily/weekly observations into one number per calendar month.
 *
 *  - "average": the mean of every observation dated in that month.
 *  - "close":   the last observation dated in that month.
 *
 * Months are calendar months in UTC ("YYYY-MM"). Because every asset is reduced
 * to one value per calendar month, it doesn't matter that Solana trades at
 * weekends and the S&P 500 doesn't: each is summarised over its own trading
 * days within the same month.
 */
import type { Method, Observation } from "./types";

export interface MonthlyPoint {
  month: string;
  value: number;
  /** How many raw observations went into this month. */
  count: number;
  firstDate: string;
  lastDate: string;
}

export const monthOf = (date: string) => date.slice(0, 7);

export function resampleMonthly(observations: Observation[], method: Method): MonthlyPoint[] {
  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const groups = new Map<string, Observation[]>();
  for (const o of sorted) {
    const m = monthOf(o.date);
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m)!.push(o);
  }
  return [...groups.entries()].map(([month, obs]) => ({
    month,
    value: method === "average" ? obs.reduce((s, o) => s + o.value, 0) / obs.length : obs[obs.length - 1].value,
    count: obs.length,
    firstDate: obs[0].date,
    lastDate: obs[obs.length - 1].date,
  }));
}

/**
 * Keep only months that every series has, within [from, to].
 * Returns the common months and any months dropped because one series lacked them.
 */
export function alignMonths(series: MonthlyPoint[][], from?: string, to?: string) {
  const inRange = (m: string) => (!from || m >= from) && (!to || m <= to);
  const sets = series.map((s) => new Set(s.filter((p) => inRange(p.month)).map((p) => p.month)));
  const all = new Set(sets.flatMap((s) => [...s]));
  const months = [...all].filter((m) => sets.every((s) => s.has(m))).sort();
  const dropped = [...all].filter((m) => !months.includes(m)).sort();
  return { months, dropped };
}

/** "2026-09" → true if that month hasn't finished yet at time `now`. */
export function isIncompleteMonth(month: string, now = new Date()): boolean {
  return month >= now.toISOString().slice(0, 7);
}

/** Month arithmetic on "YYYY-MM" strings. */
export function addMonths(month: string, k: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
