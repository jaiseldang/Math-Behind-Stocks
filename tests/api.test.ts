/**
 * API route tests. The route handlers are called directly with Request objects;
 * upstream sources are replaced by a fake fetch, so no network is needed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET as prices } from "@/app/api/prices/route";
import { GET as returns } from "@/app/api/returns/route";
import { GET as stats } from "@/app/api/stats/route";
import { POST as optimize } from "@/app/api/optimize/route";
import { GET as frontier } from "@/app/api/frontier/route";
import { GET as sensitivity } from "@/app/api/explore/sensitivity/route";
import { GET as snapshot } from "@/app/api/snapshot/route";
import { GET as docs } from "@/app/api/docs/route";
import { expectSig } from "./helpers";

const base = "http://localhost/api";
const get = async (handler: (r: Request) => Promise<Response> | Response, url: string) => {
  const res = await handler(new Request(base + url));
  return { status: res.status, body: await res.json() };
};

// ---- Fake upstream sources -------------------------------------------------
const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const wave = (i: number, base: number, amp: number, period: number) => base * (1 + amp * Math.sin(i / period) + i * 0.0004);

function fakeFetch(input: RequestInfo | URL) {
  const url = String(input);
  if (url.includes("stlouisfed")) {
    const obs = days("2023-06-01", "2026-09-29")
      .filter((d) => ![0, 6].includes(new Date(d).getUTCDay()))
      .map((date, i) => ({ date, value: i % 50 === 0 ? "." : wave(i, 4500, 0.05, 40).toFixed(2) }));
    return Promise.resolve(Response.json({ observations: obs }));
  }
  if (url.includes("gold-prices")) {
    const months = days("2023-01-01", "2026-08-31").filter((d) => d.endsWith("-01"));
    return Promise.resolve(new Response("Date,Price\n" + months.map((d, i) => `${d.slice(0, 7)},${wave(i, 1900, 0.04, 3).toFixed(3)}`).join("\n")));
  }
  if (url.includes("kraken")) {
    const weekly = url.includes("10080");
    const start = Date.parse("2023-06-01T00:00:00Z") / 1000; // a Thursday
    const step = weekly ? 7 * 86400 : 86400;
    const candles = [];
    for (let t = start, i = 0; t < Date.parse("2026-09-30T00:00:00Z") / 1000; t += step, i++) {
      candles.push([t, "0", "0", "0", wave(i, 50, 0.3, 5).toFixed(2), "0", "0", 1]);
    }
    return Promise.resolve(Response.json({ error: [], result: { SOLUSD: weekly ? candles : candles.slice(-720), last: 0 } }));
  }
  return Promise.reject(new TypeError("unexpected url " + url));
}

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pe-api-"));
  process.env.CACHE_DIR = dir;
  process.env.FRED_API_KEY = "test-key-123";
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-30T12:00:00Z") });
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.CACHE_DIR;
  delete process.env.FRED_API_KEY;
});

// ---- Snapshot mode reproduces the IA ---------------------------------------
describe("snapshot mode", () => {
  it("/api/snapshot returns the IA data with provenance", async () => {
    const { status, body } = await get(snapshot, "/snapshot");
    expect(status).toBe(200);
    expect(body.data).toHaveLength(37);
    expect(body.provenance.assets).toHaveLength(3);
    expect(body.provenance.assets[2].observationsPerMonth["2024-01"]).toBe(5); // five Wednesdays
  });

  it("/api/stats reproduces the IA means", async () => {
    const { body } = await get(stats, "/stats?source=snapshot");
    expect(body.n).toBe(36);
    expectSig(body.mean.SPX, "0.01582");
    expectSig(body.correlation[0][2], "0.3412");
  });

  it("/api/optimize at 0.02 reproduces the IA and passes every check", async () => {
    const res = await optimize(
      new Request(base + "/optimize", { method: "POST", body: JSON.stringify({ source: "snapshot", targetReturn: 0.02, amount: 1000, includeSteps: true }) }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expectSig(body.weights.SPX, "0.53736");
    expectSig(body.dollars.XAU, "455.86");
    expectSig(body.lambda2, "0.065772");
    expect(body.checks.weightsSumToOne.ok && body.checks.hitsTarget.ok && body.checks.varianceMatchesFrontier.ok).toBe(true);
    expect(body.inversionSteps.length).toBeGreaterThan(3);
    expect(body.detSigma).toBeGreaterThan(0);
  });

  it("/api/frontier gives the no-short-selling interval and slope", async () => {
    const { body } = await get(frontier, "/frontier?source=snapshot&from_mu=0.01&to_mu=0.034&step=0.001");
    expect(body.points).toHaveLength(25);
    expectSig(body.noShortSelling.lower, "0.019439");
    expectSig(body.noShortSelling.upper, "0.028941");
    expectSig(body.asymptotes.slope, "0.25841");
    expectSig(body.minimumVariance.weights.SOL, "-0.0197");
  });

  it("/api/explore/sensitivity reproduces the IA and rejects impossible ρ", async () => {
    const { body } = await get(sensitivity, "/explore/sensitivity?source=snapshot&pair=SPX,XAU&rho=-0.5,0,0.5,-0.9999");
    expectSig(body.results[0].minimumVariance.sd, "0.017091");
    expectSig(body.results[1].minimumVariance.sd, "0.024780");
    expectSig(body.results[2].minimumVariance.sd, "0.029772");
    // SPX–SOL 0.34, XAU–SOL 0.016: ρ(SPX,XAU) must lie in (−0.93, 0.95)
    expect(body.results[3].ok).toBe(false);
    expect(body.results[3].error).toMatch(/not positive definite/);
    expect(body.feasibleRange.lower).toBeGreaterThan(-1);
  });

  it("returns 422 when every ρ is impossible", async () => {
    const { status, body } = await get(sensitivity, "/explore/sensitivity?source=snapshot&pair=SPX,XAU&rho=-0.99");
    expect(status).toBe(422);
    expect(body.error).toMatch(/positive definite/);
  });

  it("warns that close needs live data", async () => {
    const { body } = await get(prices, "/prices?source=snapshot&method=close");
    expect(body.provenance.method).toBe("average");
    expect(body.provenance.warnings[0]).toMatch(/monthly averages only/);
  });

  it("filters by from/to", async () => {
    const { body } = await get(returns, "/returns?source=snapshot&from=2024-02&to=2026-08");
    expect(body.months).toHaveLength(30);
  });
});

// ---- Live mode (fake upstream) ----------------------------------------------
describe("live mode", () => {
  it("every response carries provenance with URL, time, method and observation counts", async () => {
    const { status, body } = await get(prices, "/prices?from=2023-08&to=2026-08&method=average");
    expect(status).toBe(200);
    const p = body.provenance;
    expect(p.source).toBe("live");
    expect(p.months).toMatchObject({ from: "2023-08", to: "2026-08", count: 37 });
    const [spx, xau, sol] = p.assets;
    expect(spx.url).toContain("api_key=REDACTED"); // the key never leaves the server
    expect(spx.url).not.toContain("test-key-123");
    expect(spx.frequency).toBe("daily");
    expect(spx.observationsPerMonth["2024-02"]).toBeGreaterThan(15);
    expect(xau.observationsPerMonth["2024-02"]).toBe(1);
    expect(sol.observationsPerMonth["2024-01"]).toBe(5);
    expect(sol.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("second call is served from the daily cache", async () => {
    const { body } = await get(stats, "/stats?from=2023-08&to=2026-08");
    expect(body.provenance.assets.map((a: { cache: string }) => a.cache)).toEqual(["hit", "hit", "hit"]);
  });

  it("drops the unfinished current month (2026-09)", async () => {
    const { body } = await get(prices, "/prices?assets=SPX,SOL");
    expect(body.months.at(-1)).toBe("2026-08");
  });

  it("different start dates are coverage, not gaps (gold's history starts earlier)", async () => {
    const { body } = await get(prices, "/prices");
    expect(body.months[0]).toBe("2023-06");
    expect(body.provenance.warnings.join(" ")).not.toMatch(/Months dropped/);
  });

  it("close method uses last close; gold falls back to average with a warning", async () => {
    const avg = (await get(prices, "/prices?assets=SPX,XAU&from=2024-01&to=2024-06&method=average")).body;
    const close = (await get(prices, "/prices?assets=SPX,XAU&from=2024-01&to=2024-06&method=close")).body;
    expect(close.prices.SPX[0]).not.toBe(avg.prices.SPX[0]);
    expect(close.prices.XAU).toEqual(avg.prices.XAU);
    expect(close.provenance.warnings.join(" ")).toMatch(/Gold.*monthly averages/);
  });

  it("falls back to the snapshot (with a warning) when a source is missing its key", async () => {
    delete process.env.FRED_API_KEY;
    const { body } = await get(prices, "/prices?assets=SPX,XAU&from=2023-08&to=2026-08");
    process.env.FRED_API_KEY = "test-key-123";
    expect(body.provenance.fallback).toBe(true);
    expect(body.provenance.warnings.join(" ")).toMatch(/FRED_API_KEY/);
    expect(body.prices.SPX[0]).toBe(4457.36);
  });
});

describe("validation and docs", () => {
  it("rejects bad parameters with 400", async () => {
    expect((await get(prices, "/prices?assets=SPX,BTC")).status).toBe(400);
    expect((await get(prices, "/prices?from=2024-13")).status).toBe(400);
    expect((await get(prices, "/prices?method=median")).status).toBe(400);
    const res = await optimize(new Request(base + "/optimize", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });
  it("serves an OpenAPI document listing every endpoint", async () => {
    const body = await (await docs(new Request(base + "/docs"))).json();
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining(["/api/prices", "/api/returns", "/api/stats", "/api/optimize", "/api/frontier", "/api/explore/sensitivity", "/api/snapshot"]),
    );
  });
});
