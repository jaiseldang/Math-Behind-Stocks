/**
 * S&P 500 daily closes from FRED (Federal Reserve Bank of St. Louis), series SP500.
 * Needs a free API key in the server-side environment variable FRED_API_KEY.
 * Docs: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
 */
import type { Provider, RawSeries } from "../types";
import { fetchWithRetry } from "../fetchWithRetry";

export const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface FredResponse {
  observations: { date: string; value: string }[];
}

/** FRED marks missing days (holidays) with "." — we skip them. */
export function parseFred(json: FredResponse) {
  return json.observations
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value));
}

export const fredProvider: Provider = {
  id: "fred",
  name: "FRED (Federal Reserve Bank of St. Louis), series SP500",
  assets: ["SPX"],
  unavailableReason: () => (process.env.FRED_API_KEY ? null : "FRED_API_KEY is not set on the server"),
  async fetchSeries(asset, opts = {}): Promise<RawSeries> {
    const key = process.env.FRED_API_KEY;
    if (!key) throw new Error("FRED_API_KEY is not set on the server");
    const url = `${FRED_BASE}?series_id=SP500&file_type=json&api_key=${encodeURIComponent(key)}`;
    const res = await fetchWithRetry(url, { fetchImpl: opts.fetchImpl });
    const observations = parseFred((await res.json()) as FredResponse);
    if (observations.length === 0) throw new Error("FRED returned no observations");
    return {
      asset,
      provider: "fred",
      sourceName: this.name,
      url: url.replace(key, "REDACTED"),
      frequency: "daily",
      observations,
      retrievedAt: new Date().toISOString(),
      datingRule: "Daily close, dated by trading day (US market holidays have no value).",
    };
  },
};
