import { optimizePayload } from "@/lib/api/compute";
import { handle } from "@/lib/api/http";
import { BadRequest, num, parseCommon } from "@/lib/api/query";
import { loadMonthlyPrices } from "@/lib/data/dataset";

export const dynamic = "force-dynamic";

/** POST /api/optimize  body: { assets, from, to, method, source, targetReturn, amount, includeSteps } */
export async function POST(req: Request) {
  return handle(req, async () => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new BadRequest("body must be JSON");
    }
    const q = parseCommon((k) => body[k]);
    const target = num(body.targetReturn, "targetReturn");
    const amount = num(body.amount, "amount", 1000);
    return optimizePayload(await loadMonthlyPrices(q), target, amount, body.includeSteps === true);
  });
}
