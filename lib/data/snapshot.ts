import snapshot from "@/data/snapshot.json";
import meta from "@/data/snapshot.meta.json";
import { ASSETS, type AssetId } from "@/lib/assets";

export interface SnapshotRow {
  month: string;
  sp500: number;
  gold: number;
  solana: number;
}

export const SNAPSHOT: SnapshotRow[] = snapshot as SnapshotRow[];
export const SNAPSHOT_META = meta;

/** Months (YYYY-MM) in the snapshot. */
export const SNAPSHOT_MONTHS = SNAPSHOT.map((r) => r.month);

/** Price series for the chosen assets, optionally restricted to [from, to] (inclusive, YYYY-MM). */
export function snapshotPrices(assets: AssetId[], from?: string, to?: string) {
  const rows = SNAPSHOT.filter((r) => (!from || r.month >= from) && (!to || r.month <= to));
  return {
    months: rows.map((r) => r.month),
    prices: assets.map((a) => rows.map((r) => r[ASSETS[a].snapshotKey])),
  };
}
