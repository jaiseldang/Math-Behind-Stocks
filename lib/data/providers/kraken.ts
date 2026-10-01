/**
 * Solana (SOL/USD) candles from Kraken's public OHLC endpoint (no key needed).
 * Docs: https://docs.kraken.com/api/docs/rest-api/get-ohlc-data
 *
 * Kraken returns at most the 720 most recent candles:
 *   daily  (interval=1440)  → about 2 years
 *   weekly (interval=10080) → about 14 years
 */
import type { AssetId } from "@/lib/assets";
import type { Observation, Provider, RawSeries } from "../types";
import { fetchWithRetry } from "../fetchWithRetry";

export const KRAKEN_BASE = "https://api.kraken.com/0/public/OHLC";
export const KRAKEN_NAME = "Kraken public API, pair SOLUSD";
const DAY = 86400;

export interface KrakenResponse {
  error: string[];
  result: Record<string, unknown>;
}

export const krakenInterval = (weekly: boolean) => (weekly ? 10080 : 1440);
export const krakenUrl = (weekly: boolean) => `${KRAKEN_BASE}?pair=SOLUSD&interval=${krakenInterval(weekly)}`;

/**
 * Each candle is [time, open, high, low, close, vwap, volume, count], where
 * `time` is the candle's OPEN time in Unix seconds and prices are strings.
 *
 * Dating rule: a candle is dated by its LAST day (open + interval − 1 day),
 * because that is the day its close price is recorded. Kraken's weekly candles
 * open on Thursdays, so they are dated by the following Wednesday. This is the
 * rule that reproduces the IA's month assignment exactly.
 */
export function parseKraken(json: KrakenResponse, intervalMinutes: number): Observation[] {
  if (json.error?.length) throw new Error(`Kraken error: ${json.error.join(", ")}`);
  const key = Object.keys(json.result).find((k) => k !== "last");
  if (!key) throw new Error("Kraken response had no candle data");
  const candles = json.result[key] as (string | number)[][];
  const lastDayOffset = intervalMinutes * 60 - DAY;
  return candles.map((c) => ({
    date: new Date((Number(c[0]) + lastDayOffset) * 1000).toISOString().slice(0, 10),
    value: Number(c[4]),
  }));
}

/** Turn a Kraken response into a RawSeries (no network; shared with the Apps Script build). */
export function krakenRawSeries(asset: AssetId, json: KrakenResponse, weekly: boolean): RawSeries {
  const observations = parseKraken(json, krakenInterval(weekly));
  // The newest candle is still open (its "close" is just the latest price). Drop it.
  observations.pop();
  return {
    asset,
    provider: "kraken",
    sourceName: KRAKEN_NAME,
    url: krakenUrl(weekly),
    frequency: weekly ? "weekly" : "daily",
    observations,
    retrievedAt: new Date().toISOString(),
    datingRule: weekly
      ? "Weekly candle (Thu–Wed, UTC) dated by its last day, the Wednesday its close is recorded."
      : "Daily candle (UTC) dated by its day.",
    notes: weekly ? [] : ["Kraken returns at most 720 daily candles (about 2 years)."],
  };
}

export const krakenProvider: Provider = {
  id: "kraken",
  name: KRAKEN_NAME,
  assets: ["SOL"],
  unavailableReason: () => null,
  async fetchSeries(asset, opts = {}): Promise<RawSeries> {
    const weekly = (opts.solInterval ?? "weekly") === "weekly";
    const res = await fetchWithRetry(krakenUrl(weekly), { fetchImpl: opts.fetchImpl });
    return krakenRawSeries(asset, (await res.json()) as KrakenResponse, weekly);
  },
};
