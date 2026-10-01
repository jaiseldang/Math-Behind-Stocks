/**
 * Tests for the generated Google Apps Script backend (apps-script/dist/Code.gs).
 *
 * The real generated file is run inside a Node sandbox with fake versions of
 * the Apps Script services (PropertiesService, UrlFetchApp, Utilities, …),
 * so these tests check exactly the code that gets pasted into Apps Script.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript build script
import { buildServer } from "../scripts/build-apps-script.mjs";
// @ts-expect-error: plain JavaScript helper
import { createGasSandbox } from "../scripts/gas-sandbox.mjs";
import { expectSig } from "./helpers";
import { fakeUpstream } from "./fixtures/upstream";

let code: string;
let ctx: Record<string, any>;
let store: Map<string, string>;
let fetchLog: string[];
let sleeps: number[];
let upstream: (url: string) => { status: number; text: string; headers?: Record<string, string> };

function makeContext() {
  const sb = createGasSandbox(code, (url: string) => upstream(url));
  ({ store, fetchLog, sleeps } = sb);
  return sb.ctx as Record<string, any>;
}

const api = (url: string, method = "GET", body: string | null = null) => {
  const r = ctx.handleApi(method, url, body);
  return { status: r.status as number, body: JSON.parse(r.body) };
};

beforeAll(async () => {
  code = await buildServer();
});
beforeEach(() => {
  upstream = (url) => fakeUpstream(url);
  ctx = makeContext();
});

describe("Code.gs: snapshot mode reproduces the IA", () => {
  it("stats", () => {
    const { status, body } = api("/api/stats?source=snapshot");
    expect(status).toBe(200);
    expect(body.n).toBe(36);
    expectSig(body.mean.SOL, "0.06506");
    expectSig(body.correlation[0][1], "-0.0829");
    expect(fetchLog).toHaveLength(0); // snapshot needs no network
  });

  it("optimize (via google.script.run and via doPost)", () => {
    const req = JSON.stringify({ source: "snapshot", targetReturn: 0.02, amount: 1000 });
    const { body } = api("/api/optimize", "POST", req);
    expectSig(body.weights.SPX, "0.53736");
    expectSig(body.lambda2, "0.065772");
    expect(body.checks.varianceMatchesFrontier.ok).toBe(true);
    const out = ctx.doPost({ parameter: { api: "optimize" }, postData: { contents: req, type: "application/json" } });
    expect(out.mime).toBe("application/json");
    expectSig(JSON.parse(out.text).volatility, "0.025190");
  });

  it("frontier and sensitivity through doGet ?api=", () => {
    const f = JSON.parse(ctx.doGet({ parameter: { api: "frontier", source: "snapshot" } }).text);
    expectSig(f.noShortSelling.lower, "0.019439");
    expectSig(f.noShortSelling.upper, "0.028941");
    const s = JSON.parse(ctx.doGet({ parameter: { api: "explore/sensitivity", source: "snapshot", pair: "SPX,XAU", rho: "-0.5,0,0.5" } }).text);
    expectSig(s.results[0].minimumVariance.sd, "0.017091");
    expectSig(s.results[2].minimumVariance.sd, "0.029772");
  });

  it("snapshot and docs endpoints", () => {
    expect(api("/api/snapshot").body.data).toHaveLength(37);
    const docs = api("/api/docs").body;
    expect(docs.openapi).toBe("3.1.0");
    expect(docs.info.description).toMatch(/\?api=/);
  });
});

describe("Code.gs: entry points and errors", () => {
  it("doGet without ?api serves Index.html", () => {
    const out = ctx.doGet({ parameter: {} });
    expect(out.file).toBe("Index");
    expect(out.meta.viewport).toMatch(/width=device-width/);
  });
  it("bad input is reported with a status in the body", () => {
    expect(api("/api/prices?assets=BTC").status).toBe(400);
    expect(JSON.parse(ctx.doGet({ parameter: { api: "prices", method: "median" } }).text)).toMatchObject({ status: 400 });
    expect(api("/api/nope").status).toBe(404);
    expect(api("/api/explore/sensitivity?source=snapshot&rho=-0.99").status).toBe(422);
  });
  it("serviceUrl returns the deployment URL", () => {
    expect(ctx.serviceUrl()).toMatch(/script\.google\.com/);
  });
});

describe("Code.gs: live data, cache and fallbacks", () => {
  it("falls back to the snapshot (with a clear message) when FRED_API_KEY is not set", () => {
    const { body } = api("/api/prices?from=2023-08&to=2026-08");
    expect(body.provenance.fallback).toBe(true);
    expect(body.provenance.warnings.join(" ")).toMatch(/Script Properties/);
    expect(fetchLog.some((u) => u.includes("stlouisfed"))).toBe(false);
  });

  it("fetches live data, caches it in Script Properties, then serves it from the cache", () => {
    store.set("FRED_API_KEY", "secret-key-123");
    const first = api("/api/prices?from=2023-08&to=2026-08");
    expect(first.body.provenance.assets.map((a: { cache: string }) => a.cache)).toEqual(["miss", "miss", "miss"]);
    expect(first.body.provenance.assets[0].url).toContain("REDACTED");
    expect(JSON.stringify(first.body)).not.toContain("secret-key-123");
    expect(first.body.provenance.assets[2].observationsPerMonth["2024-01"]).toBe(5);
    expect([...store.keys()].some((k) => k.startsWith("cache:SPX"))).toBe(true);
    const n = fetchLog.length;
    const second = api("/api/stats?from=2023-08&to=2026-08");
    expect(second.body.provenance.assets.map((a: { cache: string }) => a.cache)).toEqual(["hit", "hit", "hit"]);
    expect(fetchLog.length).toBe(n); // no new downloads
  });

  it("serves stale cached data with a warning when a refresh fails", () => {
    const { PortfolioExplorer } = ctx;
    PortfolioExplorer.writeCache("k", { x: 1 });
    const later = Date.now() + 2 * 86400000;
    const r = PortfolioExplorer.cachedSync("k", () => { throw new Error("source down"); }, later);
    expect(r).toMatchObject({ status: "stale", data: { x: 1 }, error: "source down" });
  });

  it("retries 429 with Retry-After, and does not retry 403", () => {
    let calls = 0;
    upstream = (url) => (url.includes("kraken") && calls++ === 0 ? { status: 429, text: "", headers: { "Retry-After": "7" } } : fakeUpstream(url));
    expect(api("/api/prices?assets=SOL,XAU").body.provenance.assets[0].cache).toBe("miss");
    expect(sleeps).toContain(7000);

    ctx = makeContext();
    upstream = (url) => (url.includes("kraken") ? { status: 403, text: "" } : fakeUpstream(url));
    const { body } = api("/api/prices?assets=SOL,XAU&from=2023-08");
    expect(fetchLog.filter((u) => u.includes("kraken"))).toHaveLength(1);
    expect(body.provenance.warnings.join(" ")).toMatch(/HTTP 403.*snapshot/);
  });

  it("clearCache removes cached data", () => {
    store.set("FRED_API_KEY", "k");
    api("/api/prices?from=2023-08");
    ctx.clearCache();
    expect([...store.keys()].filter((k) => k.startsWith("cache:"))).toHaveLength(0);
    expect(store.get("FRED_API_KEY")).toBe("k");
  });
});
