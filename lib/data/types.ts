import type { AssetId } from "@/lib/assets";

export type Method = "average" | "close";
export type Frequency = "daily" | "weekly" | "monthly";
export type DataSource = "live" | "snapshot";

/** One raw price observation, dated YYYY-MM-DD (UTC). */
export interface Observation {
  date: string;
  value: number;
}

/** What a provider returns: raw observations plus where they came from. */
export interface RawSeries {
  asset: AssetId;
  provider: string;
  sourceName: string;
  /** The URL that was requested (API keys are redacted). */
  url: string;
  frequency: Frequency;
  observations: Observation[];
  retrievedAt: string;
  /** How each observation was dated, e.g. "weekly candle dated by its closing day (Wednesday)". */
  datingRule: string;
  notes?: string[];
}

export interface FetchOptions {
  /** For Kraken: "daily" (interval=1440) or "weekly" (interval=10080). */
  solInterval?: "daily" | "weekly";
  fetchImpl?: typeof fetch;
}

/**
 * A data provider. To add Twelve Data, Alpha Vantage or Polygon later, write a
 * new object with this shape and register it in lib/data/providers/index.ts.
 */
export interface Provider {
  id: string;
  name: string;
  assets: AssetId[];
  /** Why this provider can't be used right now (e.g. missing API key), or null. */
  unavailableReason(): string | null;
  fetchSeries(asset: AssetId, opts?: FetchOptions): Promise<RawSeries>;
}

/** Provenance block attached to every API response, one per asset. */
export interface Provenance {
  asset: AssetId;
  source: string;
  url: string;
  retrievedAt: string;
  method: Method;
  frequency: Frequency;
  datingRule: string;
  /** Raw observations used for each month, e.g. { "2024-01": 21 }. */
  observationsPerMonth: Record<string, number>;
  cache: "hit" | "miss" | "stale" | "none";
  /** True when live data could not be used and something older was substituted. */
  fallback: boolean;
  warnings: string[];
}

export interface MonthlyDataset {
  months: string[];
  /** prices[i][t] = price of asset i in month t */
  prices: number[][];
  assets: AssetId[];
  method: Method;
  source: DataSource;
  provenance: Provenance[];
  warnings: string[];
}
