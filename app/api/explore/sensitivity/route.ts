import { sensitivityPayload } from "@/lib/api/compute";
import { handle } from "@/lib/api/http";
import { BadRequest, num, parseCommon } from "@/lib/api/query";
import { parseAssets, type AssetId } from "@/lib/assets";
import { loadMonthlyPrices } from "@/lib/data/dataset";

export const dynamic = "force-dynamic";

/** GET /api/explore/sensitivity?...&pair=SPX,XAU&rho=-0.5,0,0.5 */
export async function GET(req: Request) {
  return handle(req, async () => {
    const sp = new URL(req.url).searchParams;
    const q = parseCommon((k) => sp.get(k));
    let pair: AssetId[];
    try {
      pair = parseAssets(sp.get("pair") ?? "SPX,XAU");
    } catch (e) {
      throw new BadRequest((e as Error).message);
    }
    if (pair.length !== 2) throw new BadRequest("pair must name exactly two assets, e.g. SPX,XAU");
    const rhos = (sp.get("rho") ?? "-0.5,0,0.5").split(",").map((r) => num(r, "rho"));
    if (rhos.length > 50) throw new BadRequest("at most 50 rho values");
    return sensitivityPayload(await loadMonthlyPrices(q), pair as [AssetId, AssetId], rhos);
  });
}
