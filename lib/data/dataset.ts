/**
 * Load monthly prices for the requested assets, from live sources or the
 * bundled IA snapshot, with a provenance record for every asset.
 *
 * This file does the input/output (network + disk cache); the pure logic is in
 * assemble.ts so the Google Apps Script build can reuse it.
 */
import type { AssetId } from "@/lib/assets";
import { assembleDataset, failedSeries, liveSeriesFromRaw, snapshotSeries, unavailableSeries, type DatasetQuery, type SeriesResult } from "./assemble";
import { cached } from "./cache";
import { PROVIDERS } from "./providers";
import type { MonthlyDataset } from "./types";

export type { DatasetQuery } from "./assemble";
export { SNAPSHOT_RETRIEVED } from "./assemble";

async function liveSeries(asset: AssetId, q: DatasetQuery): Promise<SeriesResult> {
  const provider = PROVIDERS[asset];
  const unavailable = provider.unavailableReason();
  if (unavailable) return unavailableSeries(asset, unavailable);
  const interval = asset === "SOL" ? q.solInterval ?? "weekly" : "default";
  try {
    const result = await cached(`${provider.id}-${asset}-${interval}`, () => provider.fetchSeries(asset, { solInterval: q.solInterval, fetchImpl: q.fetchImpl }));
    return liveSeriesFromRaw(asset, q, result);
  } catch (e) {
    return failedSeries(asset, provider.name, (e as Error).message);
  }
}

export async function loadMonthlyPrices(q: DatasetQuery): Promise<MonthlyDataset> {
  const series = q.source === "snapshot" ? q.assets.map((a) => snapshotSeries(a)) : await Promise.all(q.assets.map((a) => liveSeries(a, q)));
  return assembleDataset(q, series);
}
