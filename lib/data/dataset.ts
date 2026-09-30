/**
 * Load monthly prices for the requested assets, from live sources or the
 * bundled IA snapshot, with a provenance record for every asset.
 */
import { ASSETS, type AssetId } from "@/lib/assets";
import { cached } from "./cache";
import { tradingDays, weekdayCount } from "./calendar";
import { PROVIDERS } from "./providers";
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

const SNAPSHOT_SOURCE: Record<AssetId, string> = {
  SPX: "S&P 500 monthly averages from FRED SP500 / Shiller",
  XAU: "gold monthly averages from the World Bank Pink Sheet",
  SOL: "Solana monthly averages of Kraken SOLUSD weekly closes",
};

export const SNAPSHOT_RETRIEVED = "2026-09-01T00:00:00Z";

/** Snapshot provenance: monthly averages, with the observation counts the IA used. */
function snapshotSeries(asset: AssetId, reason?: string): { points: MonthlyPoint[]; provenance: Provenance } {
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

async function liveSeries(asset: AssetId, q: DatasetQuery): Promise<{ points: MonthlyPoint[]; provenance: Provenance }> {
  const provider = PROVIDERS[asset];
  const unavailable = provider.unavailableReason();
  if (unavailable) {
    return snapshotSeries(asset, `${ASSETS[asset].name}: live source unavailable (${unavailable}); using the bundled IA snapshot instead.`);
  }
  const interval = asset === "SOL" ? q.solInterval ?? "weekly" : "default";
  let result: Awaited<ReturnType<typeof cached<RawSeries>>>;
  try {
    result = await cached(`${provider.id}-${asset}-${interval}`, () => provider.fetchSeries(asset, { solInterval: q.solInterval, fetchImpl: q.fetchImpl }));
  } catch (e) {
    return snapshotSeries(asset, `${ASSETS[asset].name}: ${provider.name} failed (${(e as Error).message}) and nothing is cached; using the bundled IA snapshot instead.`);
  }
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

export async function loadMonthlyPrices(q: DatasetQuery): Promise<MonthlyDataset> {
  const warnings: string[] = [];
  let method = q.method;
  const series =
    q.source === "snapshot"
      ? q.assets.map((a) => snapshotSeries(a))
      : await Promise.all(q.assets.map((a) => liveSeries(a, q)));
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
