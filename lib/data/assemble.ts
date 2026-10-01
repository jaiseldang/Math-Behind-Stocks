/**
 * The pure (no network, no disk) half of loading a dataset: turning raw
 * observations into monthly series with provenance, and lining the assets up.
 *
 * It is shared by the Next.js API (lib/data/dataset.ts) and the Google Apps
 * Script build (apps-script/), which differ only in how they fetch and cache.
 */
import { ASSETS, type AssetId } from "@/lib/assets";
import { tradingDays, weekdayCount } from "./calendar";
import { alignMonths, isIncompleteMonth, resampleMonthly, type MonthlyPoint } from "./resample";
import { SNAPSHOT, SNAPSHOT_META } from "./snapshot";
import type { DataSource, Method, MonthlyDataset, Provenance, RawSeries } from "./types";

export interface DatasetQuery {
  assets: AssetId[];
  from?: string;
  to?: string;
  method: Method;
  source: DataSource;
  solInterval?: "daily" | "weekly";
  fetchImpl?: typeof fetch;
  now?: Date;
}

export interface SeriesResult {
  points: MonthlyPoint[];
  provenance: Provenance;
}

/** How a cached value was obtained (see lib/data/cache.ts). */
export interface CacheResult<T> {
  data: T;
  status: "hit" | "miss" | "stale";
  savedAt: string;
  error?: string;
}

const SNAPSHOT_SOURCE: Record<AssetId, string> = {
  SPX: "S&P 500 monthly averages from FRED SP500 / Shiller",
  XAU: "gold monthly averages from the World Bank Pink Sheet",
  SOL: "Solana monthly averages of Kraken SOLUSD weekly closes",
};

export const SNAPSHOT_RETRIEVED = "2026-09-01T00:00:00Z";

/** Snapshot provenance: monthly averages, with the observation counts the IA used. */
export function snapshotSeries(asset: AssetId, reason?: string): SeriesResult {
  const key = ASSETS[asset].snapshotKey;
  const count = (month: string) =>
    asset === "SPX" ? tradingDays(month) : asset === "XAU" ? 1 : weekdayCount(month, 3); // SOL: weekly candles closing on Wednesdays
  const points = SNAPSHOT.map((r) => ({ month: r.month, value: r[key], count: count(r.month), firstDate: `${r.month}-01`, lastDate: `${r.month}-28` }));
  const rule = {
    SPX: "Monthly average of daily closes (FRED SP500 / Shiller); count = NYSE trading days.",
    XAU: "World Bank monthly average price; one value per month.",
    SOL: "Average of Kraken weekly closes dated by closing day (Wednesday); count = Wednesdays in the month.",
  }[asset];
  return {
    points,
    provenance: {
      asset,
      source: `Bundled IA snapshot (data/snapshot.json): ${SNAPSHOT_SOURCE[asset]}`,
      url: SNAPSHOT_META.sources[key],
      retrievedAt: SNAPSHOT_RETRIEVED,
      method: "average",
      frequency: "monthly",
      datingRule: rule,
      observationsPerMonth: Object.fromEntries(points.map((p) => [p.month, p.count])),
      cache: "none",
      fallback: Boolean(reason),
      warnings: reason ? [reason] : [],
    },
  };
}

/** Fallback when a live source can't even be tried (e.g. a missing API key). */
export function unavailableSeries(asset: AssetId, why: string): SeriesResult {
  return snapshotSeries(asset, `${ASSETS[asset].name}: live source unavailable (${why}); using the bundled IA snapshot instead.`);
}

/** Fallback when a live source failed and nothing was cached. */
export function failedSeries(asset: AssetId, providerName: string, error: string): SeriesResult {
  return snapshotSeries(asset, `${ASSETS[asset].name}: ${providerName} failed (${error}) and nothing is cached; using the bundled IA snapshot instead.`);
}

/** Resample a live raw series to months and record its provenance. */
export function liveSeriesFromRaw(asset: AssetId, q: DatasetQuery, result: CacheResult<RawSeries>): SeriesResult {
  const raw = result.data;
  const warnings: string[] = [...(raw.notes ?? [])];
  let method = q.method;
  if (raw.frequency === "monthly" && method === "close") {
    method = "average";
    warnings.push(`${ASSETS[asset].name}: the source only has monthly averages, so "close" is not available; used the monthly average.`);
  }
  if (result.status === "stale") {
    warnings.push(`${ASSETS[asset].name}: live refresh failed (${result.error}); showing cached data from ${result.savedAt}.`);
  }
  const now = q.now ?? new Date();
  const points = resampleMonthly(raw.observations, method).filter((p) => !isIncompleteMonth(p.month, now));
  if (q.from && points.length && points[0].month > q.from) {
    warnings.push(`${ASSETS[asset].name}: the source's data only starts in ${points[0].month}.`);
  }
  return {
    points,
    provenance: {
      asset,
      source: raw.sourceName,
      url: raw.url,
      retrievedAt: result.status === "miss" ? raw.retrievedAt : result.savedAt,
      method,
      frequency: raw.frequency,
      datingRule: raw.datingRule,
      observationsPerMonth: Object.fromEntries(points.map((p) => [p.month, p.count])),
      cache: result.status,
      fallback: result.status === "stale",
      warnings,
    },
  };
}

/** Line the assets up on the months they all share and build the dataset. */
export function assembleDataset(q: DatasetQuery, series: SeriesResult[]): MonthlyDataset {
  const warnings: string[] = [];
  let method = q.method;
  if (q.source === "snapshot" && q.method === "close") {
    method = "average";
    warnings.push('The IA snapshot stores monthly averages only, so method "close" needs live data. Showing averages.');
  }
  const { months, dropped } = alignMonths(series.map((s) => s.points), q.from, q.to);
  if (dropped.length) warnings.push(`Months dropped because not every asset has data for them: ${dropped.join(", ")}.`);
  if (months.length < 3) throw new Error("fewer than 3 common months in the requested range");

  const provenance = series.map((s) => ({
    ...s.provenance,
    observationsPerMonth: Object.fromEntries(months.map((m) => [m, s.provenance.observationsPerMonth[m] ?? 0])),
  }));
  for (const p of provenance) warnings.push(...p.warnings);
  const lookup = series.map((s) => new Map(s.points.map((p) => [p.month, p.value])));
  return {
    months,
    prices: lookup.map((m) => months.map((mo) => m.get(mo)!)),
    assets: q.assets,
    method,
    source: q.source,
    provenance,
    warnings,
  };
}
