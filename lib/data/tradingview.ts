/**
 * TradingView prices, bundled in data/tradingview.json.
 *
 * TradingView has no public data API, so the website can't fetch these itself.
 * They were pulled once through the TradingView connector in a Claude Code
 * session and saved with the repository. Each series is stored raw (daily or
 * weekly closes), so it goes through exactly the same monthly resampling as
 * live data, and the average/month-end switch works for it.
 */
import tv from "@/data/tradingview.json";
import type { AssetId } from "@/lib/assets";
import type { Frequency, RawSeries } from "./types";

interface TvSeries {
  symbol: string;
  name: string;
  frequency: Frequency;
  datingRule: string;
  observations: [string, number][];
}

const TV = tv as unknown as { retrievedAt: string; series: Record<AssetId, TvSeries> };

export const TRADINGVIEW_RETRIEVED = TV.retrievedAt;

/** The chart page on tradingview.com for a symbol, used as the provenance URL. */
export const tradingViewUrl = (symbol: string) => `https://www.tradingview.com/symbols/${symbol.replace(":", "-")}/`;

/** One bundled TradingView series in the same shape a live provider returns. */
export function tradingViewRawSeries(asset: AssetId): RawSeries {
  const s = TV.series[asset];
  return {
    asset,
    provider: "tradingview",
    sourceName: `TradingView ${s.symbol}: ${s.name} (bundled, data/tradingview.json)`,
    url: tradingViewUrl(s.symbol),
    frequency: s.frequency,
    observations: s.observations.map(([date, value]) => ({ date, value })),
    retrievedAt: TV.retrievedAt,
    datingRule: s.datingRule,
    notes: [],
  };
}
