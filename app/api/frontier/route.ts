import { frontierPayload } from "@/lib/api/compute";
import { handle } from "@/lib/api/http";
import { num, parseCommon } from "@/lib/api/query";
import { loadMonthlyPrices } from "@/lib/data/dataset";

export const dynamic = "force-dynamic";

/** GET /api/frontier?...&from_mu=0.01&to_mu=0.034&step=0.001 */
export async function GET(req: Request) {
  return handle(req, async () => {
    const sp = new URL(req.url).searchParams;
    const q = parseCommon((k) => sp.get(k));
    return frontierPayload(
      await loadMonthlyPrices(q),
      num(sp.get("from_mu"), "from_mu", 0.01),
      num(sp.get("to_mu"), "to_mu", 0.034),
      num(sp.get("step"), "step", 0.001),
    );
  });
}
