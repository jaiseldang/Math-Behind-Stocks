/** The three assets in the IA, in the order used for every vector and matrix. */
export type AssetId = "SPX" | "XAU" | "SOL";

export interface AssetInfo {
  id: AssetId;
  name: string;
  short: string;
  /** Key in data/snapshot.json */
  snapshotKey: "sp500" | "gold" | "solana";
  unit: string;
  color: string;
  tradingViewSymbol: string;
}

export const ASSETS: Record<AssetId, AssetInfo> = {
  SPX: { id: "SPX", name: "S&P 500", short: "S&P", snapshotKey: "sp500", unit: "index points", color: "var(--c-spx)", tradingViewSymbol: "FOREXCOM:SPXUSD" },
  XAU: { id: "XAU", name: "Gold", short: "Gold", snapshotKey: "gold", unit: "US$/troy oz", color: "var(--c-xau)", tradingViewSymbol: "OANDA:XAUUSD" },
  SOL: { id: "SOL", name: "Solana", short: "SOL", snapshotKey: "solana", unit: "US$", color: "var(--c-sol)", tradingViewSymbol: "KRAKEN:SOLUSD" },
};

export const DEFAULT_ASSETS: AssetId[] = ["SPX", "XAU", "SOL"];

export function parseAssets(param: string | null | undefined): AssetId[] {
  if (!param) return DEFAULT_ASSETS;
  const ids = param.split(",").map((s) => s.trim().toUpperCase());
  for (const id of ids) if (!(id in ASSETS)) throw new Error(`unknown asset "${id}" (use SPX, XAU, SOL)`);
  if (new Set(ids).size !== ids.length) throw new Error("assets must not repeat");
  return ids as AssetId[];
}
