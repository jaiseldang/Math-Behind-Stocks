/**
 * Gold, monthly average price in US$/troy oz.
 *
 * The World Bank publishes this in its "Pink Sheet" (an Excel file). The
 * datasets/gold-prices project mirrors the same monthly series as a clean CSV,
 * which we read here. It matches the IA snapshot exactly.
 */
import type { AssetId } from "@/lib/assets";
import type { Provider, RawSeries } from "../types";
import { fetchWithRetry } from "../fetchWithRetry";

export const GOLD_CSV_URL = "https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv";
export const GOLD_NAME = "World Bank Commodity Markets (Pink Sheet), via datasets/gold-prices mirror";

/** CSV rows look like "2024-01,2034.000". Monthly values are dated to the 1st. */
export function parseGoldCsv(csv: string) {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .filter(([d, v]) => /^\d{4}-\d{2}/.test(d) && Number.isFinite(Number(v)))
    .map(([d, v]) => ({ date: `${d.slice(0, 7)}-01`, value: Number(v) }));
}

/** Turn the CSV text into a RawSeries (no network; shared with the Apps Script build). */
export function goldRawSeries(asset: AssetId, csv: string): RawSeries {
  const observations = parseGoldCsv(csv);
  if (observations.length === 0) throw new Error("gold CSV was empty");
  return {
    asset,
    provider: "gold-worldbank",
    sourceName: GOLD_NAME,
    url: GOLD_CSV_URL,
    frequency: "monthly",
    observations,
    retrievedAt: new Date().toISOString(),
    datingRule: "Already a monthly average; one value per month.",
  };
}

export const goldProvider: Provider = {
  id: "gold-worldbank",
  name: GOLD_NAME,
  assets: ["XAU"],
  unavailableReason: () => null,
  async fetchSeries(asset, opts = {}): Promise<RawSeries> {
    const res = await fetchWithRetry(GOLD_CSV_URL, { fetchImpl: opts.fetchImpl });
    return goldRawSeries(asset, await res.text());
  },
};
