/**
 * Counting observations per month for the bundled snapshot, where we only have
 * the monthly averages and not the raw data.
 */

/** NYSE full-day closures, Aug 2023 – Dec 2026 (source: nyse.com holiday calendar). */
export const NYSE_HOLIDAYS = new Set([
  "2023-09-04", "2023-11-23", "2023-12-25",
  "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29", "2024-05-27", "2024-06-19", "2024-07-04",
  "2024-09-02", "2024-11-28", "2024-12-25",
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19",
  "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
  "2026-09-07", "2026-11-26", "2026-12-25",
]);

function daysOf(month: string): Date[] {
  const [y, m] = month.split("-").map(Number);
  const out: Date[] = [];
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d = new Date(d.getTime() + 86400000)) out.push(d);
  return out;
}

/** US trading days in a month: weekdays that are not NYSE holidays. */
export function tradingDays(month: string): number {
  return daysOf(month).filter((d) => {
    const wd = d.getUTCDay();
    return wd !== 0 && wd !== 6 && !NYSE_HOLIDAYS.has(d.toISOString().slice(0, 10));
  }).length;
}

/** Number of times a given weekday (0 = Sunday … 3 = Wednesday) falls in a month. */
export function weekdayCount(month: string, weekday: number): number {
  return daysOf(month).filter((d) => d.getUTCDay() === weekday).length;
}

/** Calendar days in a month (crypto trades every one of them). */
export function calendarDays(month: string): number {
  return daysOf(month).length;
}
