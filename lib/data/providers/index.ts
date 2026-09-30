import type { AssetId } from "@/lib/assets";
import type { Provider } from "../types";
import { fredProvider } from "./fred";
import { goldProvider } from "./gold";
import { krakenProvider } from "./kraken";

/**
 * Which provider supplies each asset. To try another source (Twelve Data,
 * Alpha Vantage, Polygon…), implement the Provider interface and swap it in here.
 */
export const PROVIDERS: Record<AssetId, Provider> = {
  SPX: fredProvider,
  XAU: goldProvider,
  SOL: krakenProvider,
};
