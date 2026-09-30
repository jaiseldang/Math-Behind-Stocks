import { pricesPayload } from "@/lib/api/compute";
import { handle } from "@/lib/api/http";
import { loadMonthlyPrices } from "@/lib/data/dataset";
import { SNAPSHOT, SNAPSHOT_META } from "@/lib/data/snapshot";

/** GET /api/snapshot: the exact IA dataset. Works offline. */
export async function GET(req: Request) {
  return handle(req, async () => {
    const ds = await loadMonthlyPrices({ assets: ["SPX", "XAU", "SOL"], method: "average", source: "snapshot" });
    return { meta: SNAPSHOT_META, data: SNAPSHOT, provenance: pricesPayload(ds).provenance };
  });
}
