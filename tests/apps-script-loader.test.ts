/**
 * The Apps Script loader (apps-script/loader/Code.gs) downloads the generated
 * files from GitHub. Here "GitHub" is the local apps-script/dist folder.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error: plain JavaScript helper
import { createGasSandbox } from "../scripts/gas-sandbox.mjs";
import { expectSig } from "./helpers";

const loader = readFileSync("apps-script/loader/Code.gs", "utf8");
const dist = (f: string) => readFileSync(`apps-script/dist/${f}`, "utf8");

function sandbox() {
  return createGasSandbox(loader, (url: string) => {
    const m = url.match(/raw\.githubusercontent\.com\/jaiseldang\/Math-Behind-Stocks\/[0-9a-f]{40}\/apps-script\/dist\/(.+)$/);
    if (!m) return { status: 404, text: "" };
    return { status: 200, text: dist(m[1]) };
  });
}

describe("Apps Script loader", () => {
  it("serves the website from the downloaded Index.html, then from the cache", () => {
    const sb = sandbox();
    const out = sb.ctx.doGet({ parameter: {} });
    expect(out.html).toBe(dist("Index.html"));
    expect(out.meta.viewport).toMatch(/width=device-width/);
    sb.ctx.doGet({ parameter: {} });
    expect(sb.fetchLog.filter((u: string) => u.endsWith("Index.html"))).toHaveLength(1);
  });

  it("runs the downloaded backend: API answers match the IA", () => {
    const sb = sandbox();
    const r = sb.ctx.handleApi("GET", "/api/stats?source=snapshot", null);
    expectSig(JSON.parse(r.body).mean.SPX, "0.01582");
    const f = JSON.parse(sb.ctx.doGet({ parameter: { api: "frontier", source: "snapshot" } }).text);
    expectSig(f.noShortSelling.lower, "0.019439");
    const o = JSON.parse(sb.ctx.doPost({ parameter: { api: "optimize" }, postData: { contents: '{"source":"snapshot","targetReturn":0.02}', type: "application/json" } }).text);
    expectSig(o.weights.SOL, "0.00678");
  });

  it("pins a full commit SHA that contains the dist files", () => {
    expect(loader).toMatch(/var PE_COMMIT = "[0-9a-f]{40}";/);
  });

  it("explains a failed download", () => {
    const sb = createGasSandbox(loader, () => ({ status: 404, text: "" }));
    expect(() => sb.ctx.doGet({ parameter: {} })).toThrow(/Could not download Index\.html.*HTTP 404/);
  });
});
