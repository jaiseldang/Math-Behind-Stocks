import { returnsPayload } from "@/lib/api/compute";
import { handle } from "@/lib/api/http";
import { parseCommon } from "@/lib/api/query";
import { loadMonthlyPrices } from "@/lib/data/dataset";

export const dynamic = "force-dynamic";

/** GET /api/returns?assets=SPX,XAU,SOL&from=2023-08&to=2026-08&method=average&source=live */
export async function GET(req: Request) {
  return handle(req, async () => {
    const sp = new URL(req.url).searchParams;
    return returnsPayload(await loadMonthlyPrices(parseCommon((k) => sp.get(k))));
  });
}
