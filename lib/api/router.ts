/**
 * One router for every build that can't use Next.js API routes (the Google
 * Apps Script backend, and the static website where the "API" runs in the
 * browser). Same endpoints and parameters as app/api/*.
 *
 * `load` turns a query into a dataset; each build supplies its own.
 */
import { parseAssets, type AssetId } from "@/lib/assets";
import type { DatasetQuery } from "@/lib/data/assemble";
import { SNAPSHOT, SNAPSHOT_META } from "@/lib/data/snapshot";
import type { MonthlyDataset } from "@/lib/data/types";
import { frontierPayload, optimizePayload, pricesPayload, returnsPayload, sensitivityPayload, statsPayload } from "./compute";
import { Unprocessable } from "./http";
import { openApiSpec } from "./openapi";
import { BadRequest, num, parseCommon } from "./query";

export interface ApiResult {
  status: number;
  body: unknown;
}

/** "a=1&b=x%2Cy" → { a: "1", b: "x,y" } */
export function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return out;
}

/** Route a request. `endpoint` is e.g. "prices" or "explore/sensitivity". */
export function route(
  method: string,
  endpoint: string,
  query: Record<string, string>,
  bodyText: string | null | undefined,
  load: (q: DatasetQuery) => MonthlyDataset,
  docs: () => unknown = () => openApiSpec,
): ApiResult {
  try {
    const get = (k: string) => query[k];
    switch (endpoint) {
      case "prices":
        return { status: 200, body: pricesPayload(load(parseCommon(get))) };
      case "returns":
        return { status: 200, body: returnsPayload(load(parseCommon(get))) };
      case "stats":
        return { status: 200, body: statsPayload(load(parseCommon(get))) };
      case "frontier":
        return {
          status: 200,
          body: frontierPayload(load(parseCommon(get)), num(get("from_mu"), "from_mu", 0.01), num(get("to_mu"), "to_mu", 0.034), num(get("step"), "step", 0.001)),
        };
      case "explore/sensitivity": {
        let pair: AssetId[];
        try {
          pair = parseAssets(get("pair") ?? "SPX,XAU");
        } catch (e) {
          throw new BadRequest((e as Error).message);
        }
        if (pair.length !== 2) throw new BadRequest("pair must name exactly two assets, e.g. SPX,XAU");
        const rhos = (get("rho") ?? "-0.5,0,0.5").split(",").map((r) => num(r, "rho"));
        if (rhos.length > 50) throw new BadRequest("at most 50 rho values");
        return { status: 200, body: sensitivityPayload(load(parseCommon(get)), pair as [AssetId, AssetId], rhos) };
      }
      case "optimize": {
        if (method !== "POST") throw new BadRequest("optimize needs POST with a JSON body");
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(bodyText ?? "");
        } catch {
          throw new BadRequest("body must be JSON");
        }
        const q = parseCommon((k) => body[k]);
        return { status: 200, body: optimizePayload(load(q), num(body.targetReturn, "targetReturn"), num(body.amount, "amount", 1000), body.includeSteps === true) };
      }
      case "snapshot": {
        const ds = load({ assets: ["SPX", "XAU", "SOL"], method: "average", source: "snapshot" });
        return { status: 200, body: { meta: SNAPSHOT_META, data: SNAPSHOT, provenance: pricesPayload(ds).provenance } };
      }
      case "docs":
        return { status: 200, body: docs() };
      default:
        return { status: 404, body: { error: `unknown endpoint "${endpoint}"` } };
    }
  } catch (e) {
    if (e instanceof BadRequest) return { status: 400, body: { error: e.message } };
    if (e instanceof Unprocessable) return { status: 422, body: { error: e.message, details: e.details } };
    return { status: 500, body: { error: (e as Error).message ?? "internal error" } };
  }
}
