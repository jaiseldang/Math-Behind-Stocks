/**
 * The bundled TradingView dataset (data/tradingview.json): it is intact, it
 * agrees with the IA where it should, and it runs through the same pipeline
 * and API as live data. No network is needed.
 */
import { describe, expect, it } from "vitest";
import { GET as stats } from "@/app/api/stats/route";
import { GET as prices } from "@/app/api/prices/route";
import { loadMonthlyPrices } from "@/lib/data/dataset";
import { resampleMonthly } from "@/lib/data/resample";
import { SNAPSHOT } from "@/lib/data/snapshot";
import { tradingViewRawSeries } from "@/lib/data/tradingview";
import { analysePrices, lagrangeConstants, minimumVariancePortfolio, zeroCrossings } from "@/lib/math";
import { expectSig } from "./helpers";

const NOW = new Date("2026-10-07T12:00:00Z");
const IA_RANGE = { from: "2023-08", to: "2026-08" };
const load = (method: "average" | "close", extra: object = {}) =>
  loadMonthlyPrices({ assets: ["SPX", "XAU", "SOL"], method, source: "tradingview", now: NOW, ...IA_RANGE, ...extra });

describe("bundled TradingView data", () => {
  it("has sorted, unique, positive observations on the right days", () => {
    for (const asset of ["SPX", "XAU", "SOL"] as const) {
      const obs = tradingViewRawSeries(asset).observations;
      const dates = obs.map((o) => o.date);
      expect([...dates].sort(), asset).toEqual(dates);
      expect(new Set(dates).size, asset).toBe(dates.length);
      expect(obs.every((o) => o.value > 0)).toBe(true);
      const weekdays = new Set(dates.map((d) => new Date(d + "T00:00:00Z").getUTCDay()));
      if (asset === "SOL") expect([...weekdays]).toEqual([0]); // weekly bars dated by their closing Sunday
      else expect([...weekdays].every((d) => d >= 1 && d <= 5), asset).toBe(true);
    }
  });

  it("S&P 500 monthly averages equal the IA's FRED averages, except Sep 2023", () => {
    const months = resampleMonthly(tradingViewRawSeries("SPX").observations, "average");
    const mismatched = SNAPSHOT.filter((r) => {
      const m = months.find((p) => p.month === r.month)!;
      return Math.abs(m.value - r.sp500) > 0.01;
    }).map((r) => r.month);
    expect(mismatched).toEqual(["2023-09"]);
  });

  it("the IA's Sep 2023 S&P 500 value is the 1 Sep close, not the month's average", () => {
    const obs = tradingViewRawSeries("SPX").observations.filter((o) => o.date.startsWith("2023-09"));
    expect(obs).toHaveLength(20); // 21 weekdays minus Labor Day
    expectSig(obs.reduce((s, o) => s + o.value, 0) / obs.length, "4409.10", "Sep 2023 average");
    expect(Math.abs(obs[0].value - SNAPSHOT[1].sp500)).toBeLessThan(0.02);
  });

  it("gold stays within 1% of the World Bank averages every month", () => {
    const months = resampleMonthly(tradingViewRawSeries("XAU").observations, "average");
    for (const r of SNAPSHOT) {
      const m = months.find((p) => p.month === r.month)!;
      expect(Math.abs(m.value / r.gold - 1), r.month).toBeLessThan(0.01);
    }
  });
});

describe("source=tradingview through the pipeline", () => {
  it("covers the IA's 37 months with provenance", async () => {
    const ds = await load("average");
    expect(ds.months).toEqual(SNAPSHOT.map((r) => r.month));
    expect(ds.source).toBe("tradingview");
    expect(ds.warnings).toEqual([]);
    for (const p of ds.provenance) {
      expect(p.source).toMatch(/^TradingView /);
      expect(p.url).toMatch(/^https:\/\/www\.tradingview\.com\/symbols\//);
      expect(p.cache).toBe("none");
      expect(p.fallback).toBe(false);
    }
    expect(ds.provenance[0].observationsPerMonth["2023-09"]).toBe(20);
    expect(ds.provenance[2].observationsPerMonth["2024-03"]).toBe(5); // five Sundays
  });

  it("runs to the last complete month when no end is given", async () => {
    const ds = await load("average", { to: undefined });
    expect(ds.months.at(-1)).toBe("2026-09");
  });

  it("supports month-end closes (unlike the snapshot)", async () => {
    const avg = await load("average");
    const close = await load("close");
    expect(close.method).toBe("close");
    expect(close.prices[0][0]).toBe(4507.67); // S&P 500 close on 31 Aug 2023
    expect(close.prices[0][0]).not.toBe(avg.prices[0][0]);
  });

  it("warns that daily Solana isn't bundled", async () => {
    const ds = await load("average", { solInterval: "daily" });
    expect(ds.warnings.join(" ")).toMatch(/weekly closes only/);
  });

  it("gives nearly the same no-short-selling band as the IA", async () => {
    const ds = await load("average");
    const s = analysePrices(ds.prices);
    const k = lagrangeConstants(s.Sigma, s.means);
    const band = zeroCrossings(k).noShortInterval!;
    expectSig(band.lower, "0.01955");
    expectSig(band.upper, "0.02888");
    expectSig(Math.sqrt(minimumVariancePortfolio(k).variance), "0.02257");
  });
});

describe("API with source=tradingview", () => {
  const get = async (handler: (r: Request) => Promise<Response> | Response, url: string) => {
    const res = await handler(new Request("http://localhost/api" + url));
    return { status: res.status, body: await res.json() };
  };

  it("/api/prices and /api/stats work offline", async () => {
    const p = await get(prices, "/prices?source=tradingview&from=2023-08&to=2026-08&method=close");
    expect(p.status).toBe(200);
    expect(p.body.months).toHaveLength(37);
    expect(p.body.provenance.assets[1].source).toMatch(/TVC:GOLD/);
    const s = await get(stats, "/stats?source=tradingview&from=2023-08&to=2026-08");
    expect(s.status).toBe(200);
    expect(s.body.n).toBe(36);
  });

  it("rejects an unknown source", async () => {
    const r = await get(prices, "/prices?source=yahoo");
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/tradingview/);
  });
});
